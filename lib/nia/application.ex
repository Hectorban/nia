defmodule Nia.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      NiaWeb.Telemetry,
      Nia.Repo,
      {DNSCluster, query: Application.get_env(:nia, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Nia.PubSub},
      {Finch, name: Nia.Finch},
      NiaWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Nia.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    NiaWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
