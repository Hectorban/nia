defmodule Nia.Repo.Migrations.CreateMessages do
  use Ecto.Migration

  def change do
    create table(:messages) do
      add :content, :map
      add :type, :string
      add :attachments, :string
      add :chat_id, :uuid
      add :author, :string

      timestamps(type: :utc_datetime)
    end
  end
end
