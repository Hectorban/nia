defmodule NiaWeb.ChatLive.Home do
  use NiaWeb, :live_view

  alias Nia.Chats
  alias Nia.Chats.Chat

  @impl true
  def mount(_params, _session, socket) do
    {:ok, socket |> assign(:page_title, "Nia")}
  end
end
