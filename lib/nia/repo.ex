defmodule Nia.Repo do
  use Ecto.Repo,
    otp_app: :nia,
    adapter: Ecto.Adapters.SQLite3
end
