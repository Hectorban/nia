defmodule Nia.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      NiaWeb.Telemetry,
      Nia.Repo,
      {DNSCluster, query: Application.get_env(:nia, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Nia.PubSub},
      # Start the Finch HTTP client for sending emails
      {Finch, name: Nia.Finch},
      # Start a dedicated Finch HTTP client for OpenAI
      {Finch, name: Nia.Llm.finch_pool_name()},
      # Start a worker by calling: Nia.Worker.start_link(arg)
      # {Nia.Worker, arg},
      # Start to serve requests, typically the last entry
      NiaWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Nia.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    NiaWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
