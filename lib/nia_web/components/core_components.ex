defmodule NiaWeb.CoreComponents do
  @moduledoc false
  use Phoenix.Component
  use NiaWeb, :verified_routes
  use NiaComponents
  use Gettext, backend: NiaWeb.Gettext

  import NiaWeb.ColorSchemeSwitch
  import NiaWeb.Helpers
  import NiaWeb.SidebarLayout
  import NiaWeb.SocialButton
  import NiaWeb.StackedLayout

  alias Phoenix.LiveView.JS

  # SETUP_TODO
  # This module relies on the following images. Replace these images with your logos.
  # We created a Figma file to easily create and import these assets: https://www.figma.com/community/file/1139155923924401853
  # /priv/static/images/logo_dark.svg
  # /priv/static/images/logo_light.svg

  # /priv/static/images/logo_icon_dark.svg
  # /priv/static/images/logo_icon_light.svg
  # /priv/static/images/favicon.png
  # /priv/static/images/open-graph.png

  @doc "Displays your full logo. "

  attr :class, :string, default: "h-10"
  attr :variant, :string, default: "both", values: ["dark", "light", "both"]

  def logo(assigns) do
    assigns = assign_new(assigns, :logo_file, fn -> "logo_#{assigns[:variant]}.svg" end)

    ~H"""
    <%= if Enum.member?(["light", "dark"], @variant) do %>
      <img class={@class} src={~p"/images/#{@logo_file}"} alt={Nia.config(:app_name)} />
    <% else %>
      <img
        class={@class <> " block dark:hidden"}
        src={~p"/images/logo_dark.svg"}
        alt={Nia.config(:app_name)}
      />
      <img
        class={@class <> " hidden dark:block"}
        src={~p"/images/logo_light.svg"}
        alt={Nia.config(:app_name)}
      />
    <% end %>
    """
  end

  @doc "Displays just the icon part of your logo"

  attr :class, :string, default: "h-9 w-9"
  attr :variant, :string, default: "both", values: ["dark", "light", "both"]

  def logo_icon(assigns) do
    assigns = assign_new(assigns, :logo_file, fn -> "logo_icon_#{assigns[:variant]}.svg" end)

    ~H"""
    <%= if Enum.member?(["light", "dark"], @variant) do %>
      <img class={@class} src={~p"/images/#{@logo_file}"} alt={Nia.config(:app_name)} />
    <% else %>
      <img
        class={@class <> " block dark:hidden"}
        src={~p"/images/logo_icon_dark.svg"}
        alt={Nia.config(:app_name)}
      />
      <img
        class={@class <> " hidden dark:block"}
        src={~p"/images/logo_icon_light.svg"}
        alt={Nia.config(:app_name)}
      />
    <% end %>
    """
  end

  def logo_for_emails(assigns) do
    ~H"""
    <img height="60" src={Nia.config(:logo_url_for_emails)} />
    """
  end

  attr :current_user, :map, default: nil
  attr :max_width, :string, default: "lg", values: ["sm", "md", "lg", "xl", "full"]

  def footer(assigns) do
    ~H"""
    <section id="footer">
      <div class="py-20">
        <.container max_width={@max_width}>
          <div class="flex flex-wrap items-center justify-between pb-12 border-b border-gray-200 dark:border-gray-800">
            <div class="w-full mb-12 md:w-1/5 md:mb-0">
              <a class="inline-block text-3xl font-bold leading-none" href="/">
                <.logo class="h-10" />
              </a>
            </div>
            <div class="w-full md:w-auto">
              <ul class="flex flex-wrap items-center md:space-x-5">
                <.list_menu_items
                  li_class="w-full mb-2 md:w-auto md:mb-0"
                  a_class="text-gray-700 dark:text-gray-300 md:text-sm hover:text-gray-800 dark:hover:text-gray-400"
                  menu_items={public_menu_items(@current_user)}
                />
              </ul>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-between mt-8">
            <div class="order-last text-sm text-gray-600 dark:text-gray-400">
              <div>
                © {Timex.now().year} {Nia.config(:business_name) <>
                  ". All rights reserved."}
              </div>

              <div class="mt-2 divide-x divide-gray-500 dark:divide-gray-400">
                <.link href="/privacy" class="pr-3 hover:text-gray-900 dark:hover:text-gray-300">
                  Privacy Policy
                </.link>
                <.link href="/license" class="px-3 hover:text-gray-900 dark:hover:text-gray-300">
                  License
                </.link>
              </div>
            </div>
            <div class="order-first mb-4 md:mb-0 md:order-last">
              <%= if Nia.config(:twitter_url) do %>
                <a target="_blank" class={social_a_class()} href={Nia.config(:twitter_url)}>
                  <svg
                    class={social_svg_class()}
                    xmlns="http://www.w3.org/2000/svg"
                    data-name="Layer 1"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22,5.8a8.49,8.49,0,0,1-2.36.64,4.13,4.13,0,0,0,1.81-2.27,8.21,8.21,0,0,1-2.61,1,4.1,4.1,0,0,0-7,3.74A11.64,11.64,0,0,1,3.39,4.62a4.16,4.16,0,0,0-.55,2.07A4.09,4.09,0,0,0,4.66,10.1,4.05,4.05,0,0,1,2.8,9.59v.05a4.1,4.1,0,0,0,3.3,4A3.93,3.93,0,0,1,5,13.81a4.9,4.9,0,0,1-.77-.07,4.11,4.11,0,0,0,3.83,2.84A8.22,8.22,0,0,1,3,18.34a7.93,7.93,0,0,1-1-.06,11.57,11.57,0,0,0,6.29,1.85A11.59,11.59,0,0,0,20,8.45c0-.17,0-.35,0-.53A8.43,8.43,0,0,0,22,5.8Z" />
                  </svg>
                </a>
              <% end %>

              <%= if Nia.config(:github_url) do %>
                <a target="_blank" class={social_a_class()} href={Nia.config(:github_url)}>
                  <svg
                    class={social_svg_class()}
                    xmlns="http://www.w3.org/2000/svg"
                    data-name="Layer 1"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12,2.2467A10.00042,10.00042,0,0,0,8.83752,21.73419c.5.08752.6875-.21247.6875-.475,0-.23749-.01251-1.025-.01251-1.86249C7,19.85919,6.35,18.78423,6.15,18.22173A3.636,3.636,0,0,0,5.125,16.8092c-.35-.1875-.85-.65-.01251-.66248A2.00117,2.00117,0,0,1,6.65,17.17169a2.13742,2.13742,0,0,0,2.91248.825A2.10376,2.10376,0,0,1,10.2,16.65923c-2.225-.25-4.55-1.11254-4.55-4.9375a3.89187,3.89187,0,0,1,1.025-2.6875,3.59373,3.59373,0,0,1,.1-2.65s.83747-.26251,2.75,1.025a9.42747,9.42747,0,0,1,5,0c1.91248-1.3,2.75-1.025,2.75-1.025a3.59323,3.59323,0,0,1,.1,2.65,3.869,3.869,0,0,1,1.025,2.6875c0,3.83747-2.33752,4.6875-4.5625,4.9375a2.36814,2.36814,0,0,1,.675,1.85c0,1.33752-.01251,2.41248-.01251,2.75,0,.26251.1875.575.6875.475A10.0053,10.0053,0,0,0,12,2.2467Z" />
                  </svg>
                </a>
              <% end %>

              <%= if Nia.config(:discord_url) do %>
                <a target="_blank" class={social_a_class()} href={Nia.config(:discord_url)}>
                  <svg
                    class={social_svg_class()}
                    xmlns="http://www.w3.org/2000/svg"
                    data-name="Layer 1"
                    viewBox="0 0 16 16"
                  >
                    <path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z" />
                  </svg>
                </a>
              <% end %>
            </div>
          </div>
        </.container>
      </div>
    </section>
    """
  end

  defp social_a_class,
    do: "inline-block p-2 rounded-sm dark:bg-gray-800 bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600 group"

  defp social_svg_class, do: "w-5 h-5 fill-white dark:fill-gray-400 group-hover:fill-white"

  @doc """
  A kind of proxy layout allowing you to pass in a user. Layout components should have little knowledge about your application so this is a way you can pass in a user and it will build a lot of the attributes for you based off the user.

  Ideally you should modify this file a lot and not touch the actual layout components like "sidebar_layout" and "stacked_layout".
  If you're creating a new layout then duplicate "sidebar_layout" or "stacked_layout" and give it a new name. Then modify this file to allow your new layout. This way live views can keep using this component and simply switch the "type" attribute to your new layout.
  """
  attr :type, :string, default: "sidebar", values: ["sidebar", "stacked", "public"]
  attr :show_notification_bell, :boolean, default: true
  attr :current_page, :atom, required: true
  attr :current_user, :map, default: nil
  attr :public_menu_items, :list
  attr :main_menu_items, :list
  attr :user_menu_items, :list
  attr :avatar_src, :string
  attr :current_user_name, :string
  attr :sidebar_title, :string, default: nil
  attr :home_path, :string
  attr :container_max_width, :string, default: "lg", values: ["sm", "md", "lg", "xl", "full"]
  attr :collapsible, :boolean, default: true
  attr :collapsed_only, :boolean, default: false
  attr :default_collapsed, :boolean, default: false
  slot :logo_icon
  slot :inner_block
  slot :top_right
  slot :top_right_mobile
  slot :logo

  def layout(assigns) do
    assigns =
      assigns
      |> assign_new(:public_menu_items, fn -> public_menu_items(assigns[:current_user]) end)
      |> assign_new(:main_menu_items, fn -> main_menu_items(assigns[:current_user]) end)
      |> assign_new(:user_menu_items, fn -> user_menu_items(assigns[:current_user]) end)
      |> assign_new(:current_user_name, fn -> user_name(assigns[:current_user]) end)
      |> assign_new(:avatar_src, fn -> user_avatar_url(assigns[:current_user]) end)
      |> assign_new(:home_path, fn -> home_path(assigns[:current_user]) end)

    ~H"""
    <%= case @type do %>
      <% "sidebar" -> %>
        <.sidebar_layout {assigns}>
          <:logo>
            <.logo class="h-8 transition-transform duration-300 ease-out transform hover:scale-105" />
          </:logo>
          <:logo_icon>
            <.logo_icon />
          </:logo_icon>
          <:top_right>
            <.color_scheme_switch />
            <.live_component
              :if={@show_notification_bell}
              module={NiaWeb.NotificationBellComponent}
              id={NiaWeb.NotificationBellComponent.lc_id()}
              current_user={@current_user}
            />
          </:top_right>
          {render_slot(@inner_block)}
        </.sidebar_layout>
      <% "stacked" -> %>
        <.stacked_layout {assigns}>
          <:logo>
            <div class="flex items-center shrink-0 w-24 h-full">
              <div class="hidden lg:block">
                <.logo class="h-8" />
              </div>
              <div class="block lg:hidden">
                <.logo_icon class="w-auto h-8" />
              </div>
            </div>
          </:logo>
          <:top_right>
            <.color_scheme_switch />
            <.live_component
              :if={@show_notification_bell}
              module={NiaWeb.NotificationBellComponent}
              id={NiaWeb.NotificationBellComponent.lc_id()}
              current_user={@current_user}
            />
          </:top_right>
          <:top_right_mobile>
            <.color_scheme_switch />
            <.live_component
              :if={@show_notification_bell}
              module={NiaWeb.NotificationBellComponent}
              id={NiaWeb.NotificationBellComponent.lc_id("mobile")}
              dropdown_id={NiaWeb.NotificationBellComponent.dropdown_id("mobile")}
              icon_button_id={NiaWeb.NotificationBellComponent.icon_button_id("mobile")}
              current_user={@current_user}
            />
          </:top_right_mobile>
          {render_slot(@inner_block)}
        </.stacked_layout>
    <% end %>
    """
  end

  # Shows the login buttons for all available providers. Can add a break "Or login with"
  attr :or_location, :string, default: "", values: ["top", "bottom", ""]
  attr :or_text, :string, default: "Or"
  attr :conn_or_socket, :any

  def auth_providers(assigns) do
    ~H"""
    <%= if auth_provider_loaded?("google") || auth_provider_loaded?("github") || auth_provider_loaded?("passwordless") do %>
      <%= if @or_location == "top" do %>
        <.or_break or_text={@or_text} />
      <% end %>

      <div class="flex flex-col gap-2">
        <%= if auth_provider_loaded?("passwordless") do %>
          <.link
            navigate={~p"/auth/sign-in/passwordless"}
            class="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium leading-5 text-gray-700 bg-white border border-gray-300 rounded-md hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50 focus:outline-hidden focus:border-gray-400 focus:bg-gray-100 focus:text-gray-900 active:border-gray-400 active:bg-gray-200 active:text-black dark:text-gray-300 dark:focus:text-gray-100 dark:active:text-gray-100 dark:hover:text-gray-200 dark:bg-transparent dark:hover:bg-gray-800 dark:hover:border-gray-400 dark:border-gray-500 dark:focus:border-gray-300 dark:active:border-gray-300"
          >
            <.icon name="hero-envelope" class="w-5 h-5" />
            <span class="ml-2">{gettext("Continue with passwordless")}</span>
          </.link>
        <% end %>

        <%= if auth_provider_loaded?("google") do %>
          <.social_button
            link_type="a"
            to={~p"/auth/google"}
            variant="outline"
            logo="google"
            class="w-full"
          />
        <% end %>

        <%= if auth_provider_loaded?("github") do %>
          <.social_button
            link_type="a"
            to={~p"/auth/github"}
            variant="outline"
            logo="github"
            class="w-full"
          />
        <% end %>
      </div>

      <%= if @or_location == "bottom" do %>
        <.or_break or_text={@or_text} />
      <% end %>
    <% end %>
    """
  end

  @doc """
  Checks if a ueberauth provider has been enabled with the correct environment variables

  ## Examples

      iex> auth_provider_loaded?("google")
      iex> true
  """
  def auth_provider_loaded?(provider) do
    case provider do
      "google" ->
        get_in(Application.get_env(:ueberauth, Ueberauth.Strategy.Google.OAuth), [:client_id])

      "github" ->
        get_in(Application.get_env(:ueberauth, Ueberauth.Strategy.Github.OAuth), [:client_id])

      "passwordless" ->
        Nia.config(:passwordless_enabled)
    end
  end

  # Shows a line with some text in the middle of the line. eg "Or login with"
  attr :or_text, :string

  def or_break(assigns) do
    ~H"""
    <div class="relative my-5">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
      </div>
      <div class="relative flex justify-center text-sm">
        <span class="px-2 text-gray-500 bg-white dark:bg-gray-800">
          {@or_text}
        </span>
      </div>
    </div>
    """
  end

  attr :li_class, :string, default: ""
  attr :a_class, :string, default: ""
  attr :menu_items, :list, default: [], doc: "list of maps with keys :method, :path, :label"

  def list_menu_items(assigns) do
    ~H"""
    <%= for menu_item <- @menu_items do %>
      <li class={@li_class}>
        <.link
          href={menu_item.path}
          class={@a_class}
          method={if menu_item[:method], do: menu_item[:method], else: nil}
        >
          {menu_item.label}
        </.link>
      </li>
    <% end %>
    """
  end

  @doc """
  Generates a generic error message.
  """
  slot :inner_block, required: true

  def error(assigns) do
    ~H"""
    <p class="flex gap-3 my-3 text-sm leading-6 text-rose-600">
      <.icon name="hero-exclamation-circle-mini" class="mt-0.5 h-5 w-5 flex-none fill-rose-500" />
      {render_slot(@inner_block)}
    </p>
    """
  end

  ## Original Core Components

  @doc """
  Renders a header with title.
  """
  attr :class, :string, default: nil

  slot :inner_block, required: true
  slot :subtitle
  slot :actions

  def header(assigns) do
    ~H"""
    <header class={[@actions != [] && "flex items-center justify-between gap-6", @class]}>
      <div>
        <h1 class="text-lg font-semibold leading-8 text-gray-700 dark:text-gray-300">
          {render_slot(@inner_block)}
        </h1>
        <p :if={@subtitle != []} class="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
          {render_slot(@subtitle)}
        </p>
      </div>
      <div class="flex-none">{render_slot(@actions)}</div>
    </header>
    """
  end

  @doc """
  Renders a simple form.

  ## Examples

      <.simple_form for={@form} phx-change="validate" phx-submit="save">
        <.input field={@form[:email]} label="Email"/>
        <.input field={@form[:username]} label="Username" />
        <:actions>
          <.button>Save</.button>
        </:actions>
      </.simple_form>
  """
  attr :for, :any, required: true, doc: "the data structure for the form"
  attr :as, :any, default: nil, doc: "the server side parameter to collect all input under"

  attr :rest, :global,
    include: ~w(autocomplete name rel action enctype method novalidate target multipart),
    doc: "the arbitrary HTML attributes to apply to the form tag"

  slot :inner_block, required: true
  slot :actions, doc: "the slot for form actions, such as a submit button"

  def simple_form(assigns) do
    ~H"""
    <.form :let={f} for={@for} as={@as} {@rest}>
      <div class="mt-6 space-y-4">
        {render_slot(@inner_block, f)}
        <div :for={action <- @actions} class="mt-2 flex items-center justify-between gap-6">
          {render_slot(action, f)}
        </div>
      </div>
    </.form>
    """
  end

  @doc """
  Renders a data list.

  ## Examples

      <.list>
        <:item title="Title"><%= @post.title %></:item>
        <:item title="Views"><%= @post.views %></:item>
      </.list>
  """
  slot :item, required: true do
    attr :title, :string, required: true
  end

  def list(assigns) do
    ~H"""
    <div class="mt-14">
      <dl class="-my-4 divide-y divide-gray-100 dark:divide-gray-900">
        <div :for={item <- @item} class="flex gap-4 py-4 text-sm leading-6 sm:gap-8">
          <dt class="w-1/4 flex-none text-gray-700 dark:text-gray-300 font-bold">
            {item.title}
          </dt>
          <dd class="text-gray-700 dark:text-gray-300">{render_slot(item)}</dd>
        </div>
      </dl>
    </div>
    """
  end

  @doc """
  Renders a back navigation link.

  ## Examples

      <.back navigate={~p"/posts"}>Back to posts</.back>
  """
  attr :navigate, :any, required: true
  slot :inner_block, required: true

  def back(assigns) do
    ~H"""
    <div class="mt-16">
      <.link
        navigate={@navigate}
        class="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 flex items-center place-self-start"
      >
        <.icon name="hero-arrow-left-solid" class="h-3 w-3 mr-1" />
        {render_slot(@inner_block)}
      </.link>
    </div>
    """
  end

  ## JS Commands

  def show(js \\ %JS{}, selector) do
    JS.show(js,
      to: selector,
      time: 300,
      transition:
        {"transition-all transform ease-out duration-300", "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95",
         "opacity-100 translate-y-0 sm:scale-100"}
    )
  end

  def hide(js \\ %JS{}, selector) do
    JS.hide(js,
      to: selector,
      time: 200,
      transition:
        {"transition-all transform ease-in duration-200", "opacity-100 translate-y-0 sm:scale-100",
         "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"}
    )
  end

  @doc """
  Translates an error message using gettext.
  """
  def translate_error({msg, opts}) do
    # When using gettext, we typically pass the strings we want
    # to translate as a static argument:
    #
    #     # Translate "is invalid" in the "errors" domain
    #     dgettext("errors", "is invalid")
    #
    #     # Translate the number of files with plural rules
    #     dngettext("errors", "1 file", "%{count} files", count)
    #
    # Because the error messages we show in our forms and APIs
    # are defined inside Ecto, we need to translate them dynamically.
    # This requires us to call the Gettext module passing our gettext
    # backend as first argument.
    #
    # Note we use the "errors" domain, which means translations
    # should be written to the errors.po file. The :count option is
    # set by Ecto and indicates we should also apply plural rules.
    if count = opts[:count] do
      Gettext.dngettext(NiaWeb.Gettext, "errors", msg, msg, count, opts)
    else
      Gettext.dgettext(NiaWeb.Gettext, "errors", msg, opts)
    end
  end

  @doc """
  Translates the errors for a field from a keyword list of errors.
  """
  def translate_errors(errors, field) when is_list(errors) do
    for {^field, {msg, opts}} <- errors, do: translate_error({msg, opts})
  end

  @doc """
  Use for when you want to combine all form errors into one message (maybe to display in a flash)
  """
  def combine_changeset_error_messages(changeset) do
    errors =
      Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
        Enum.reduce(opts, msg, fn {key, value}, acc ->
          String.replace(acc, "%{#{key}}", to_string(value))
        end)
      end)

    Enum.map_join(errors, "\n", fn {key, errors} ->
      "#{Phoenix.Naming.humanize(key)}: #{Enum.join(errors, ", ")}\n"
    end)
  end
end
