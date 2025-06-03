defmodule Nia.Chats.Message do
  use Ecto.Schema
  import Ecto.Changeset

  schema "messages" do
    field :type, :string
    field :author, :string
    field :content, :map
    field :attachments, :string
    field :chat_id, Ecto.UUID

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(message, attrs) do
    message
    |> cast(attrs, [:content, :type, :attachments, :chat_id, :author])
    |> validate_required([:type, :attachments, :chat_id, :author])
  end
end
