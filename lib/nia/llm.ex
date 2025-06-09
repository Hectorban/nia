defmodule Nia.Llm do
  @moduledoc """
  Handles interactions with the OpenAI LLM APIs.
  """

  require Logger

  @openai_api_base "https://api.openai.com/v1"
  @finch_pool_name Nia.FinchOpenAI

  def finch_pool_name(), do: @finch_pool_name

  def speech_to_text(audio_binary, api_key) when is_binary(audio_binary) and is_binary(api_key) do
    url = @openai_api_base <> "/audio/transcriptions"
    headers = common_headers(api_key)

    form_data = [
      {:file, audio_binary, {"audio.wav", [{"Content-Type", "audio/wav"}]}},
      {:model, "whisper-1"}
    ]

    case Finch.build(:post, url, headers, {:multipart, form_data}) |> Finch.request(@finch_pool_name) do
      {:ok, %{status: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"text" => transcribed_text}} -> {:ok, transcribed_text}
          {:ok, other_response} ->
            Logger.error("OpenAI speech_to_text unexpected JSON response: #{inspect(other_response)}")
            {:error, :json_parsing_error}
          {:error, reason} ->
            Logger.error("OpenAI speech_to_text JSON decoding error: #{inspect(reason)}")
            {:error, :json_parsing_error}
        end
      {:ok, %{status: status, body: body}} ->
        Logger.error("OpenAI speech_to_text error - Status: #{status}, Body: #{inspect(body)}")
        {:error, {:http_error, status, body}}
      {:error, reason} ->
        Logger.error("OpenAI speech_to_text Finch request error: #{inspect(reason)}")
        {:error, reason}
    end
  end

  def stream_chat_completion(messages_history, new_message_content, api_key, live_view_pid) do
    Task.async(fn ->
      url = @openai_api_base <> "/chat/completions"
      headers = common_headers(api_key) ++ [{"Accept", "text/event-stream"}]

      all_messages =
        Enum.map(messages_history, fn msg -> %{role: msg.role, content: msg.content} end) ++
          [%{role: "user", content: new_message_content}]

      body = %{
        model: "gpt-3.5-turbo",
        messages: all_messages,
        stream: true
      }

      case Finch.build(:post, url, headers, {:json, body}) |> Finch.stream(@finch_pool_name, self(), &handle_stream_chunk/3) do
        :ok ->
          receive do
            {:finch_stream_ended, _ref} ->
              send(live_view_pid, {:llm_stream_end})
            {:finch_stream_error, _ref, reason} ->
              Logger.error("OpenAI chat stream error: #{inspect(reason)}")
              send(live_view_pid, {:llm_stream_error, reason})
          after
            30_000 ->
              Logger.error("OpenAI chat stream timed out waiting for completion.")
              send(live_view_pid, {:llm_stream_error, :timeout})
          end
        {:error, reason} ->
          Logger.error("OpenAI chat stream request setup error: #{inspect(reason)}")
          send(live_view_pid, {:llm_stream_error, reason})
      end
    end)
  end

  def text_to_speech(text_input, api_key, voice \\ "alloy") when is_binary(text_input) and is_binary(api_key) do
    url = @openai_api_base <> "/audio/speech"
    headers = common_headers(api_key)

    body = %{
      model: "tts-1",
      input: text_input,
      voice: voice
    }

    case Finch.build(:post, url, headers, {:json, body}) |> Finch.request(@finch_pool_name) do
      {:ok, %{status: 200, body: audio_binary}} ->
        {:ok, audio_binary}
      {:ok, %{status: status, body: error_body}} ->
        Logger.error("OpenAI text_to_speech error - Status: #{status}, Body: #{inspect(error_body)}")
        {:error, {:http_error, status, error_body}}
      {:error, reason} ->
        Logger.error("OpenAI text_to_speech Finch request error: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp common_headers(api_key) do
    [
      {"Authorization", "Bearer #{api_key}"},
      {"Content-Type", "application/json"}
    ]
  end

  defp handle_stream_chunk({:status, status}, _ref, live_view_pid) do
    Logger.debug("OpenAI stream status: #{status}")
    {:ok, live_view_pid}
  end

  defp handle_stream_chunk({:headers, _headers}, _ref, live_view_pid) do
    {:ok, live_view_pid}
  end

  defp handle_stream_chunk({:data, data_chunk}, _ref, live_view_pid) do
    data_chunk
    |> String.split("\n\n")
    |> Enum.each(fn event_str ->
      if String.starts_with?(event_str, "data: ") do
        json_str = String.trim_leading(event_str, "data: ")

        if String.trim(json_str) == "[DONE]" do
          # Stream end handled by :finch_stream_ended
        else
          case Jason.decode(json_str) do
            {:ok, %{"choices" => [%{"delta" => %{"content" => content}}]}} when not is_nil(content) ->
              send(live_view_pid, {:llm_chunk, content})
            {:ok, %{"choices" => [%{"delta" => _}]}} ->
              :ok
            {:ok, other_json} ->
              Logger.warn("OpenAI stream unexpected JSON structure: #{inspect(other_json)}")
            {:error, reason} ->
              Logger.warn("OpenAI stream JSON decoding error: #{inspect(reason)} for chunk: #{json_str}")
          end
        end
      end
    end)
    {:ok, live_view_pid}
  end
end
