defmodule Nia.Llm do
  use GenServer
  require Logger

  alias Jason

  @openai_ws_base "wss://api.openai.com/v1/realtime"
  @default_model "gpt-4o-realtime" 

  # Client API
  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name))
  end

  def send_text_message(pid, text_content) do
    GenServer.cast(pid, {:send_text, text_content})
  end

  def send_audio_chunk(pid, audio_binary_chunk) do
    GenServer.cast(pid, {:send_audio, audio_binary_chunk})
  end

  def update_session_settings(pid, settings) do
    GenServer.cast(pid, {:update_session, settings})
  end

  def close_session(pid) do
    GenServer.cast(pid, :close_session)
  end

  # GenServer Callbacks
  @impl true
  def init(opts) do
    live_view_pid = Keyword.fetch!(opts, :live_view_pid)
    api_key = Keyword.fetch!(opts, :api_key)

    state = %{
      live_view_pid: live_view_pid,
      api_key: api_key,
      ws_client: nil,
      model: Keyword.get(opts, :model, @default_model),
      session_id: nil,
      is_active: false,
      request_id_counter: 0
    }

    send(self(), :connect_websocket)
    {:ok, state}
  end

  @impl true
  def handle_cast({:send_text, text_content}, state) do
    item_event = %{
      type: "conversation.item.create",
      item: %{
        type: "message",
        role: "user",
        content: [%{type: "input_text", text: text_content}]
      }
    }

    response_event = %{
      type: "response.create",
      response: %{}
    }

    send_websocket_message(state.ws_client, item_event)
    send_websocket_message(state.ws_client, response_event)
    {:noreply, state}
  end

  @impl true
  def handle_cast({:send_audio, audio_chunk_binary}, state) do
    base64_audio = Base.encode64(audio_chunk_binary)

    event = %{
      type: "input_audio_buffer.append",
      audio: base64_audio
    }

    send_websocket_message(state.ws_client, event)
    {:noreply, state}
  end

  @impl true
  def handle_cast({:update_session, settings}, state) do
    event = %{
      type: "session.update",
      session: settings
    }
    send_websocket_message(state.ws_client, event)
    {:noreply, state}
  end

  @impl true
  def handle_cast(:close_session, state) do
    if state.ws_client do
      WebSockex.close(state.ws_client)
    end
    {:stop, :normal, state}
  end

  @impl true
  def handle_info(:connect_websocket, state) do
    ws_url = "#{@openai_ws_base}?model=#{state.model}"
    headers = [
      {"Authorization", "Bearer #{state.api_key}"},
      {"OpenAI-Beta", "realtime=v1"}
    ]

    case WebSockex.start_link(ws_url, __MODULE__, self(), extra_headers: headers) do
      {:ok, ws_client_pid} ->
        {:noreply, %{state | ws_client: ws_client_pid}}
      {:error, reason} ->
        send(state.live_view_pid, {:llm_error, {:ws_connect_failed, reason}})
        {:stop, {:ws_connect_failed, reason}, state}
    end
  end

  def handle_connect(conn, state) do
    Logger.info("Connected to OpenAI WebSocket")
    {:ok, state}
  end

  def handle_frame({:text, msg_json}, state) do
    case Jason.decode(msg_json) do
      {:ok, event_payload} ->
        handle_openai_event(event_payload, state)
      {:error, reason} ->
        Logger.error("Failed to decode JSON from WebSocket: #{inspect(reason)}")
    end
    {:ok, state}
  end

  def handle_frame({:close, _payload}, state) do
    {:stop, :normal, state}
  end

  def handle_disconnect(_reason, state) do
    send(state.live_view_pid, {:llm_error, :websocket_disconnected})
    {:stop, :disconnected, state}
  end

  @impl true
  def terminate(reason, state) do
    if state.ws_client && WebSockex.connection?(state.ws_client) do
      WebSockex.close(state.ws_client)
    end
    send(state.live_view_pid, {:llm_terminated, reason})
    :ok
  end

  defp send_websocket_message(ws_client, payload) do
    if ws_client do
      case Jason.encode(payload) do
        {:ok, json_payload} -> WebSockex.send_frame(ws_client, {:text, json_payload})
        {:error, reason} -> Logger.error("Failed to encode JSON for WebSocket: #{inspect(reason)}")
      end
    end
  end

  defp handle_openai_event(%{"type" => "session.created"} = event, state) do
    session_id = get_in(event, ["session", "id"])
    send(state.live_view_pid, {:llm_session_ready, %{session_id: session_id}})
    %{state | session_id: session_id, is_active: true}
  end

  defp handle_openai_event(%{"type" => "response.audio_transcript.delta"} = event, state) do
    text_delta = get_in(event, ["delta", "text"])
    if text_delta, do: send(state.live_view_pid, {:llm_user_transcription_delta, text_delta})
    state
  end

  defp handle_openai_event(%{"type" => "response.text.delta"} = event, state) do
    text_delta = get_in(event, ["delta", "text"])
    if text_delta, do: send(state.live_view_pid, {:llm_assistant_text_delta, text_delta})
    state
  end

  defp handle_openai_event(%{"type" => "response.audio.delta"} = event, state) do
    base64_audio_delta = get_in(event, ["delta"])
    if base64_audio_delta do
      case Base.decode64(base64_audio_delta) do
        {:ok, audio_binary} -> send(state.live_view_pid, {:llm_assistant_audio_chunk, audio_binary})
        :error -> Logger.error("Failed to base64 decode audio.delta")
      end
    end
    state
  end

  defp handle_openai_event(%{"type" => "response.done"} = event, state) do
    send(state.live_view_pid, {:llm_response_done, event["response"]})
    state
  end

  defp handle_openai_event(%{"type" => type} = event, state) when type in ["error", "invalid_request_error"] do
    send(state.live_view_pid, {:llm_error, event})
    state
  end

  defp handle_openai_event(event, state) do
    Logger.warning("Unhandled OpenAI event type: #{get_in(event, ["type"])}")
    state
  end
end
