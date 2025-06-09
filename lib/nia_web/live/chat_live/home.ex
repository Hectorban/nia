defmodule NiaWeb.ChatLive.Home do
  use NiaWeb, :live_view
  alias Nia.Llm

  @upload_id :audio_upload

  @impl true
  def mount(_params, _session, socket) do
    api_key = System.get_env("OPENAI_API_KEY")

    if is_nil(api_key) or String.trim(api_key) == "" do
      {:ok,
       socket
       |> assign(
         page_title: "Nia - Error",
         llm_service_pid: nil,
         messages: [],
         current_user_transcription: "",
         current_assistant_response: "",
         is_loading_llm: false,
         session_active: false,
         last_error: "OpenAI API Key is not configured."
       )
       |> allow_upload(@upload_id, accept: :any, auto_upload: false)}
    else
      {:ok, llm_pid} = Llm.start_link(live_view_pid: self(), api_key: api_key)

      {:ok,
       socket
       |> assign(
         page_title: "Nia Realtime Chat",
         llm_service_pid: llm_pid,
         messages: [],
         current_user_transcription: "",
         current_assistant_response: "",
         is_loading_llm: true,
         session_active: false,
         last_error: nil
       )
       |> allow_upload(@upload_id, accept: :any, auto_upload: true, progress: &handle_audio_progress/3)}
    end
  end

  @impl true
  def terminate(_reason, socket) do
    if socket.assigns.llm_service_pid do
      Llm.close_session(socket.assigns.llm_service_pid)
    end
    :ok
  end

  @impl true
  def handle_event("send_text_message", %{"user_text_input" => text}, socket) do
    text = String.trim(text)
    if text == "" || !socket.assigns.session_active do
      {:noreply, socket}
    else
      new_messages = socket.assigns.messages ++ [%{role: "user", content: text}]
      Llm.send_text_message(socket.assigns.llm_service_pid, text)
      {:noreply,
       socket
       |> assign(messages: new_messages, current_assistant_response: "", is_loading_llm: true)
       |> push_event("clear_input", %{id: "user_text_input"})}
    end
  end

  @impl true
  def handle_event("end_session_button", _, socket) do
    if socket.assigns.llm_service_pid do
      Llm.close_session(socket.assigns.llm_service_pid)
    end
    {:noreply, assign(socket, is_loading_llm: true)}
  end

  @impl true
  def handle_event("retry_connection_button", _, socket) do
    api_key = System.get_env("OPENAI_API_KEY")
    if api_key do
      {:ok, llm_pid} = Llm.start_link(live_view_pid: self(), api_key: api_key)
      {:noreply, assign(socket, llm_service_pid: llm_pid, last_error: nil, is_loading_llm: true, session_active: false)}
    else
      {:noreply, assign(socket, last_error: "API Key still not configured.")}
    end
  end

  def handle_audio_progress(@upload_id, entry, socket) do
    if entry.done? do
      if !socket.assigns.session_active do
        consume_uploaded_entry(socket, entry, fn %{path: path} -> File.rm(path) end)
        {:noreply, socket}
      else
        audio_binary =
          consume_uploaded_entry(socket, entry, fn %{path: path} ->
            {:ok, File.read!(path)}
          end)

        Llm.send_audio_chunk(socket.assigns.llm_service_pid, audio_binary)

        {:noreply, assign(socket, current_user_transcription: "", is_loading_llm: true)}
      end
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_info({:llm_session_ready, _payload}, socket) do
    {:noreply, assign(socket, session_active: true, is_loading_llm: false, last_error: nil)}
  end

  @impl true
  def handle_info({:llm_user_transcription_delta, text_delta}, socket) do
    updated_transcription = socket.assigns.current_user_transcription <> text_delta
    {:noreply, assign(socket, current_user_transcription: updated_transcription, is_loading_llm: false)}
  end

  @impl true
  def handle_info({:llm_assistant_text_delta, text_delta}, socket) do
    updated_response = socket.assigns.current_assistant_response <> text_delta
    {:noreply, assign(socket, current_assistant_response: updated_response, is_loading_llm: true)}
  end

  @impl true
  def handle_info({:llm_assistant_audio_chunk, audio_binary}, socket) do
    push_event(socket, "play_audio", %{data: audio_binary})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:llm_response_done, _response_payload}, socket) do
    new_messages = socket.assigns.messages

    new_messages =
      if String.trim(socket.assigns.current_user_transcription) != "" do
        new_messages ++ [%{role: "user", content: socket.assigns.current_user_transcription}]
      else
        new_messages
      end

    new_messages =
      if String.trim(socket.assigns.current_assistant_response) != "" do
        new_messages ++ [%{role: "assistant", content: socket.assigns.current_assistant_response}]
      else
        new_messages
      end

    {:noreply,
     assign(socket,
       messages: new_messages,
       current_user_transcription: "",
       current_assistant_response: "",
       is_loading_llm: false
     )}
  end

  @impl true
  def handle_info({:llm_error, reason}, socket) do
    error_message =
      case reason do
        {:ws_connect_failed, _e} -> "Failed to connect to AI service."
        :websocket_disconnected -> "Disconnected from AI service. Please retry."
        %{"message" => msg} -> "AI Error: #{msg}"
        _ -> "An unexpected error occurred with the AI service."
      end
    {:noreply, assign(socket, is_loading_llm: false, session_active: false, last_error: error_message)}
  end

  @impl true
  def handle_info({:llm_terminated, reason}, socket) do
    current_error = if reason != :normal, do: "AI session ended unexpectedly.", else: nil
    {:noreply, assign(socket, llm_service_pid: nil, session_active: false, is_loading_llm: false, last_error: current_error || socket.assigns.last_error)}
  end
end
