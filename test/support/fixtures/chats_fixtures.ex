defmodule Nia.ChatsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Nia.Chats` context.
  """

  @doc """
  Generate a chat.
  """
  def chat_fixture(attrs \\ %{}) do
    {:ok, chat} =
      attrs
      |> Enum.into(%{
        title: "some title"
      })
      |> Nia.Chats.create_chat()

    chat
  end

  @doc """
  Generate a message.
  """
  def message_fixture(attrs \\ %{}) do
    {:ok, message} =
      attrs
      |> Enum.into(%{
        attachments: "some attachments",
        author: "some author",
        chat_id: "7488a646-e31f-11e4-aace-600308960662",
        content: %{},
        type: "some type"
      })
      |> Nia.Chats.create_message()

    message
  end
end
