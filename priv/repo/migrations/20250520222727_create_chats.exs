defmodule Nia.Repo.Migrations.CreateChats do
  use Ecto.Migration

  def change do
    create table(:chats) do
      add :title, :string

      timestamps(type: :utc_datetime)
    end
  end
end
