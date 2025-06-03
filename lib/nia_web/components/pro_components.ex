defmodule NiaComponents do
  @moduledoc false
  defmacro __using__(_) do
    quote do
      import NiaWeb.Aurora
      import NiaWeb.AuthLayout
      import NiaWeb.BorderBeam
      import NiaWeb.ColorSchemeSwitch
      import NiaWeb.ComboBox
      import NiaWeb.ContentEditor
      import NiaWeb.DataTable
      import NiaWeb.Flash
      import NiaWeb.FloatingDiv
      import NiaWeb.LanguageSelect
      import NiaWeb.LocalTime
      import NiaWeb.Markdown
      import NiaWeb.Navbar
      import NiaWeb.PageComponents
      import NiaWeb.RouteTree
      import NiaWeb.SidebarLayout
      import NiaWeb.SocialButton
      import NiaWeb.StackedLayout
    end
  end
end
