import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :nia, Nia.Repo,
  adapter: Ecto.Adapters.SQLite3,
  database: "priv/repo/nia_test#{System.get_env("MIX_TEST_PARTITION")}.sqlite3",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :nia, NiaWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "6jJkhC66JC3zzzP4VmAvjrI0eQ1ClC7QFTDU3IHZ7MKKl/Acr4bX/ClD9+AY/eP7",
  server: false

# In test we don't send emails
config :nia, Nia.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true
