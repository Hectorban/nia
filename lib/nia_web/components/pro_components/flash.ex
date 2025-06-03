defmodule NiaWeb.Flash do
  @moduledoc false
  use Phoenix.Component

  import PetalComponents.Icon

  alias Phoenix.LiveView.JS

  @doc """
  Renders a flash from a flash. Pairs with RemoveFlashHook
  """
  attr :content, :string
  attr :type, :atom, values: [:success, :warning, :info, :error]
  attr :is_static, :boolean, default: false
  attr :id, :string

  attr :timer_length, :integer,
    default: 10_000,
    doc: "how long until the flash disappears in milliseconds"

  attr :rest, :global

  def flash(assigns) do
    assigns =
      assign_new(assigns, :id, fn -> "flash-#{assigns.type}-#{Ecto.UUID.generate()}" end)

    ~H"""
    <div
      :if={@content}
      {@rest}
      id={@id}
      phx-hook="ClearFlashHook"
      phx-mounted={show_flash(@id)}
      data-timer-length={@timer_length}
      data-type={@type}
      data-is-static={if @is_static, do: "true", else: "false"}
      class={[
        flash_css(@type),
        "rounded-lg shadow-lg text-white sm:w-full hidden group",
        !@is_static && "cursor-pointer"
      ]}
    >
      <div class="overflow-hidden rounded-lg shadow-xs">
        <div
          :if={!@is_static}
          class={"#{progress_css(@type)} h-2 progress ease-linear w-0"}
          style="transition-property:width;"
        >
        </div>
        <div class="flex items-start p-4">
          <div class="shrink-0">
            <.icon :if={@type == :success} name="hero-check-circle" class="w-6 h-6" />
            <.icon :if={@type == :info} name="hero-information-circle" class="w-6 h-6" />
            <.icon :if={@type in [:warning, :error]} name="hero-exclamation-circle" class="w-6 h-6" />
          </div>
          <div class="ml-3 w-0 flex-1 pt-0.5">
            <div class="text-sm font-medium leading-5 text-white">
              <div class="whitespace-pre-line">{@content}</div>
            </div>
          </div>
          <div class="flex shrink-0 ml-4">
            <button
              :if={!@is_static}
              class="inline-flex text-white transition duration-300 ease-in-out focus:outline-hidden focus:text-gray-300 group-hover:scale-150"
            >
              <.icon name="hero-x-mark" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
    """
  end

  attr :flash, :map
  attr :timer_length, :integer, default: 10_000

  def flash_group(assigns) do
    ~H"""
    <div id="flash_group" class="fixed bottom-0 right-0 z-[9999] w-5/6 max-w-sm m-4 space-y-4">
      <%= for type <- [:error, :warning, :success, :info] do %>
        <% content = Phoenix.Flash.get(@flash, type) %>
        <%= if is_list(content) do %>
          <%= for msg <- content do %>
            <.flash type={type} content={msg} timer_length={@timer_length} />
          <% end %>
        <% else %>
          <.flash type={type} content={content} timer_length={@timer_length} />
        <% end %>
      <% end %>

      <div
        id="disconnected"
        phx-disconnected={show_flash("disconnected")}
        phx-connected={hide_flash("disconnected")}
        hidden
      >
        <.flash
          type={:error}
          is_static
          id="disconnected-flash"
          content="Internet lost. Attempting reconnection..."
          timer_length={99999}
        />
      </div>
    </div>
    """
  end

  defp show_flash(id) do
    JS.show(
      to: "##{id}",
      transition: {"transition-all transform ease-out duration-300", "opacity-0", "opacity-100"},
      time: 300
    )
  end

  defp hide_flash(id) do
    JS.hide(
      to: "##{id}",
      transition: {"transition-all transform ease-in duration-200", "opacity-100", "opacity-0"}
    )
  end

  defp flash_css(type) do
    case type do
      :success -> "bg-success-600"
      :info -> "bg-info-600"
      :warning -> "bg-warning-600"
      :error -> "bg-danger-600"
    end
  end

  defp progress_css(type) do
    case type do
      :success -> "bg-success-800 opacity-100"
      :info -> "bg-info-800 opacity-100"
      :warning -> "bg-warning-800 opacity-100"
      :error -> "bg-danger-800 opacity-100"
    end
  end
end
