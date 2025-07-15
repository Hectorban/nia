defmodule NiaWeb.Menus do
  @moduledoc """
  Describe all of your navigation menus in here. This keeps you from having to define them in a layout template
  """
  use NiaWeb, :verified_routes
  use Gettext, backend: PetalProWeb.Gettext

  alias Nia.Billing.Customers
  alias NiaWeb.Helpers

  # Public menu (marketing related pages)
  def public_menu_items(_user \\ nil),
    do: [
      %{label: gettext("Features"), path: "/#features"},
      %{label: gettext("Testimonials"), path: "/#testimonials"},
      %{label: gettext("Pricing"), path: "/#pricing"},
      %{label: gettext("Blog"), path: "/blog"}
    ]

  # Signed out main menu
  def main_menu_items(nil), do: []

  # Signed in main menu
  def main_menu_items(current_user), do: build_menu([:dashboard, :orgs, :subscribe, :user_ai_chat], current_user)

  # Signed out user menu
  def user_menu_items(nil), do: build_menu([:sign_in, :register], nil)

  # Signed in user menu
  def user_menu_items(current_user), do: build_menu([:dashboard, :settings, :admin, :dev, :sign_out], current_user)

  def build_menu(menu_items, current_user \\ nil) do
    menu_items
    |> Enum.map(fn menu_item ->
      cond do
        is_atom(menu_item) ->
          get_link(menu_item, current_user)

        is_map(menu_item) ->
          Map.merge(
            get_link(menu_item.name, current_user),
            menu_item
          )
      end
    end)
    |> Enum.filter(& &1)
  end

  def get_link(name, current_user \\ nil)

  def get_link(:register = name, _current_user) do
    %{
      name: name,
      label: gettext("Register"),
      path: ~p"/auth/register",
      icon: "hero-clipboard-document-list"
    }
  end

  def get_link(:sign_in = name, _current_user) do
    %{
      name: name,
      label: gettext("Sign in"),
      path: ~p"/auth/sign-in",
      icon: "hero-key"
    }
  end

  def get_link(:sign_out = name, current_user) do
    if current_user.current_impersonator do
      %{
        name: name,
        label: gettext("Exit impersonation"),
        path: ~p"/auth/impersonate",
        icon: "hero-arrow-right-on-rectangle",
        method: :delete
      }
    else
      %{
        name: name,
        label: gettext("Sign out"),
        path: ~p"/auth/sign-out",
        icon: "hero-arrow-right-on-rectangle",
        method: :delete
      }
    end
  end

  def get_link(:settings = name, _current_user) do
    %{
      name: name,
      label: gettext("Settings"),
      path: ~p"/app/users/edit-profile",
      icon: "hero-cog"
    }
  end

  def get_link(:edit_profile = name, _current_user) do
    %{
      name: name,
      label: gettext("Edit profile"),
      path: ~p"/app/users/edit-profile",
      icon: "hero-user-circle"
    }
  end

  def get_link(:edit_email = name, _current_user) do
    %{
      name: name,
      label: gettext("Change email"),
      path: ~p"/app/users/edit-email",
      icon: "hero-at-symbol"
    }
  end

  def get_link(:edit_notifications = name, _current_user) do
    %{
      name: name,
      label: gettext("Edit notifications"),
      path: ~p"/app/users/edit-notifications",
      icon: "hero-bell"
    }
  end

  def get_link(:edit_password = name, _current_user) do
    %{
      name: name,
      label: gettext("Edit password"),
      path: ~p"/app/users/change-password",
      icon: "hero-key"
    }
  end

  def get_link(:org_invitations = name, _current_user) do
    %{
      name: name,
      label: gettext("Invitations"),
      path: ~p"/app/users/org-invitations",
      icon: "hero-envelope"
    }
  end

  def get_link(:edit_totp = name, _current_user) do
    %{
      name: name,
      label: gettext("2FA"),
      path: ~p"/app/users/two-factor-authentication",
      icon: "hero-shield-check"
    }
  end

  def get_link(:dashboard = name, _current_user) do
    %{
      name: name,
      label: gettext("Dashboard"),
      path: ~p"/app",
      icon: "hero-rectangle-group"
    }
  end

  def get_link(:orgs = name, _current_user) do
    %{
      name: name,
      label: gettext("Organizations"),
      path: ~p"/app/orgs",
      icon: "hero-building-office"
    }
  end

  def get_link(:subscribe = name, _current_user) do
    if Customers.entity() == :user do
      %{
        name: name,
        label: gettext("Subscribe"),
        path: ~p"/app/subscribe",
        icon: "hero-shopping-bag"
      }
    end
  end

  def get_link(:billing = name, _current_user) do
    if Customers.entity() == :user do
      %{
        name: name,
        label: gettext("Billing"),
        path: ~p"/app/billing",
        icon: "hero-credit-card"
      }
    end
  end

  def get_link(:user_ai_chat = name, _current_user) do
    %{
      name: name,
      label: gettext("AI Chat"),
      path: ~p"/app/ai-chat",
      icon: "hero-command-line"
    }
  end

  def get_link(:admin, current_user) do
    link = get_link(:admin_dashboard, current_user)

    if link do
      link
      |> Map.put(:label, gettext("Admin"))
      |> Map.put(:icon, "hero-lock-closed")
    end
  end

  def get_link(:admin_dashboard = name, current_user) do
    if Helpers.admin?(current_user) do
      %{
        name: name,
        label: "Admin dashboard",
        path: ~p"/admin/dashboard",
        icon: "hero-lock-closed"
      }
    end
  end

  def get_link(:admin_users = name, current_user) do
    if Helpers.admin?(current_user) do
      %{
        name: name,
        label: gettext("Users"),
        path: ~p"/admin/users",
        icon: "hero-users"
      }
    end
  end

  def get_link(:admin_orgs = name, current_user) do
    if Helpers.admin?(current_user) do
      %{
        name: name,
        label: gettext("Orgs"),
        path: ~p"/admin/orgs",
        icon: "hero-building-office-2"
      }
    end
  end

  def get_link(:admin_posts = name, current_user) do
    if Helpers.admin?(current_user) do
      %{
        name: name,
        label: gettext("Posts"),
        path: ~p"/admin/posts",
        icon: "hero-signal"
      }
    end
  end

  def get_link(:admin_logs = name, current_user) do
    if Helpers.admin?(current_user) do
      %{
        name: name,
        label: gettext("Logs"),
        path: ~p"/admin/logs",
        icon: "hero-eye"
      }
    end
  end

  def get_link(:admin_interactive = name, current_user) do
    if Helpers.admin?(current_user) do
      %{
        name: name,
        label: gettext("Admin AI Chat"),
        path: ~p"/admin/ai-chat",
        icon: "hero-command-line"
      }
    end
  end

  def get_link(:admin_subscriptions = name, current_user) do
    if Helpers.admin?(current_user) do
      %{
        name: name,
        label: gettext("Subscriptions"),
        path: ~p"/admin/subscriptions",
        icon: "hero-wallet"
      }
    end
  end

  def get_link(:dev = name, _current_user) do
    if PetalPro.config(:env) == :dev do
      %{
        name: name,
        label: gettext("Dev"),
        path: "/dev",
        icon: "hero-code-bracket"
      }
    end
  end

  def get_link(:dev_email_templates = name, _current_user) do
    if PetalPro.config(:env) == :dev do
      %{
        name: name,
        label: gettext("Email templates"),
        path: "/dev/emails",
        icon: "hero-rectangle-group"
      }
    end
  end

  def get_link(:dev_sent_emails = name, _current_user) do
    if PetalPro.config(:env) == :dev do
      %{
        name: name,
        label: gettext("Sent emails"),
        path: "/dev/emails/sent",
        icon: "hero-at-symbol"
      }
    end
  end

  def get_link(:dev_resources = name, _current_user) do
    if PetalPro.config(:env) == :dev do
      %{
        name: name,
        label: gettext("Resources"),
        path: ~p"/dev/resources",
        icon: "hero-clipboard-document-list"
      }
    end
  end

  def get_link(:dev_swagger = name, _current_user) do
    if PetalPro.config(:env) == :dev do
      %{
        name: name,
        label: gettext("Swagger UI"),
        path: ~p"/dev/swaggerui",
        icon: "hero-code-bracket-square"
      }
    end
  end
end
