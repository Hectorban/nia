defmodule NiaWeb.ChatLive.Home do
  use NiaWeb, :live_view

  alias Nia.Chats
  alias Nia.Chats.Chat
  alias Nia.Llm

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Nia")
     |> assign(:messages, [])
     |> allow_upload(:audio,
       accept: ~w(.wav),
       max_entries: 1,
       auto_upload: true
     )}
  end

  @impl true
  def handle_event("start_recording", _, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_event("stop_recording", _, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_event("cancel_recording", _, socket) do
    {:noreply, cancel_upload(socket, :audio)}
  end

  @impl true
  def handle_event("submit-audio", _, socket) do
    case consume_uploaded_entries(socket, :audio, fn %{path: path}, _entry ->
           File.read!(path)
         end) do
      [audio_data] ->
        case Llm.speech_to_text(audio_data, System.get_env("OPENAI_API_KEY")) do
          {:ok, text} ->
            handle_new_message(socket, text)

          {:error, reason} ->
            {:noreply, put_flash(socket, :error, "Failed to transcribe audio: #{inspect(reason)}")}
        end

      _ ->
        {:noreply, put_flash(socket, :error, "No audio file found")}
    end
  end

  defp handle_new_message(socket, text) do
    messages = socket.assigns.messages ++ [%{role: "user", content: text}]
    
    socket =
      socket
      |> assign(:messages, messages)
      |> assign(:response_text, "")
      |> assign(:waiting_for_response, true)

    Task.async(fn ->
      Llm.stream_chat_completion(messages, text, System.get_env("OPENAI_API_KEY"), self())
    end)

    {:noreply, socket}
  end

  @impl true
  def handle_info({:llm_chunk, chunk}, socket) do
    {:noreply, update(socket, :response_text, fn text -> (text || "") <> chunk end)}
  end

  @impl true
  def handle_info({:llm_stream_end}, socket) do
    messages = socket.assigns.messages ++ [%{role: "assistant", content: socket.assigns.response_text}]
    {:noreply, 
     socket
     |> assign(:messages, messages)
     |> assign(:response_text, nil)
     |> assign(:waiting_for_response, false)}
  end

  @impl true
  def handle_info({:llm_stream_error, reason}, socket) do
    {:noreply,
     socket
     |> put_flash(:error, "Error getting response: #{inspect(reason)}")
     |> assign(:waiting_for_response, false)}
  end
end
