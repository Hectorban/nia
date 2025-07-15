defmodule NiaWeb.FileUploadComponents do
  @moduledoc false
  use NiaWeb, :component
  use Gettext, backend: NiaWeb.Gettext

  import PetalComponents.Field

  @doc """
  A file upload input. Shows the current image, a preview of the incoming image and a delete button.
  Designed for 1 image uploads.
  """

  attr :upload, :map, required: true
  attr :current_image_src, :string, default: nil
  attr :current_image_class, :string, default: "h-16 w-16 rounded-md"

  attr :new_image_class, :string, doc: "classes for the new image. Defaults to current_image_class"

  attr :automatic_help_text, :boolean, default: false
  attr :help_text, :string, default: nil
  attr :max_translation, :string, default: "max"
  attr :label, :string, default: "Image"
  attr :class, :string, default: nil

  attr :delete_button_class, :string,
    default:
      "rounded-full w-6 h-6 p-0 m-0 absolute bottom-[-10%] right-[-10%] bg-gray-700/70 text-white hover:bg-gray-700 dark:hover:bg-gray-500/50"

  attr :on_delete, :string,
    default: nil,
    doc: "live view event to trigger when the delete button is clicked"

  attr :confirm_delete_text, :string, default: "Are you sure you want to remove this image?"

  attr :placeholder_icon, :string,
    default: "hero-photo-solid",
    doc: "the icon inside the placeholder image. Defaults to :photo, but you could use :user for an avatar"

  attr :rest, :global

  slot :placeholder

  def image_input(assigns) do
    assigns =
      assigns
      |> assign_new(:new_image_class, fn -> assigns.current_image_class end)
      |> assign_new(:phx_target, fn -> assigns.rest[:"phx-target"] end)

    ~H"""
    <div class={["mb-6", @class]} phx-drop-target={@upload.ref}>
      <.field_label for={@upload.ref}>{@label}</.field_label>

      <div class="flex flex-col gap-5 md:items-center md:flex-row">
        <div class="flex items-center gap-3">
          <div :if={@current_image_src} class="relative shrink-0">
            <img class={@current_image_class} src={@current_image_src} />

            <button
              :if={@current_image_src && @on_delete}
              type="button"
              phx-click={@on_delete}
              phx-target={@phx_target}
              data-confirm={@confirm_delete_text}
              class={@delete_button_class}
            >
              <.icon name="hero-x-mark-solid" class="h-4 w-4 -mt-1" />
            </button>
          </div>

          <div :if={!@current_image_src && render_slot(@placeholder)} class="relative shrink-0">
            {render_slot(@placeholder)}
          </div>

          <.dummy_image
            :if={!@current_image_src && !render_slot(@placeholder)}
            class={["self-center", @current_image_class]}
            inner_icon={@placeholder_icon}
          />

          <%= if @upload.entries != [] do %>
            <.icon name="hero-arrow-right-solid" class="h-5" />
            <%= for entry <- @upload.entries do %>
              <div class="relative shrink-0">
                <.live_img_preview entry={entry} class={@new_image_class} />
                <button
                  type="button"
                  phx-click="cancel-upload"
                  phx-target={@phx_target}
                  phx-value-ref={entry.ref}
                  aria-label="cancel"
                  class={@delete_button_class}
                >
                  <.icon name="hero-x-mark-solid" class="h-4 w-4 -mt-1" />
                </button>
              </div>
            <% end %>
          <% end %>
        </div>

        <div>
          <.live_file_input
            upload={@upload}
            class="block w-full text-sm rounded-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-gray-700 dark:file:text-gray-300 dark:hover:file:bg-gray-600 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 cursor-pointer"
          />

          <p :if={@automatic_help_text} class="pc-form-help-text">
            {Enum.join(@upload.acceptable_exts, ", ")}
            <%= if @upload.max_file_size do %>
              ({@max_translation} {Sizeable.filesize(@upload.max_file_size)})
            <% end %>
          </p>

          <p :if={@help_text} class="pc-form-help-text">
            {@help_text}
          </p>

          <%= for entry <- @upload.entries do %>
            <%= for err <- upload_errors(@upload, entry) do %>
              <.field_error>{error_to_string(err)}</.field_error>
            <% end %>
          <% end %>
        </div>
      </div>

      <section>
        <%= for entry <- @upload.entries do %>
          <article class="hidden mt-2 justify-items-center phx-submit-loading:block">
            <div class="flex gap-2 w-full">
              <.progress color="primary" value={entry.progress} max={100} class="grow mt-2" />

              <button
                type="button"
                phx-click="cancel-upload"
                phx-value-ref={entry.ref}
                aria-label="cancel"
              >
                &times;
              </button>
            </div>

            <p class="pc-form-help-text">
              {entry.client_name}
            </p>
          </article>
        <% end %>
      </section>
    </div>
    """
  end

  @doc """
  A file upload input. Shows the current image, a preview of the incoming image and a delete button.
  Designed for 1 image uploads.
  """

  attr :upload, :map, required: true
  attr :current_image_src, :string, default: nil
  attr :current_image_class, :string, default: "h-16 w-16 rounded-md"

  attr :new_image_class, :string, doc: "classes for the new image. Defaults to current_image_class"

  attr :automatic_help_text, :boolean, default: false
  attr :help_text, :string, default: nil
  attr :max_translation, :string, default: "max"
  attr :label, :string, default: "Image"
  attr :class, :string, default: nil

  attr :delete_button_class, :string,
    default:
      "rounded-full w-6 h-6 p-0 m-0 absolute bottom-[-10%] right-[-10%] bg-gray-700/70 text-white hover:bg-gray-700 dark:hover:bg-gray-500/50"

  attr :on_delete, :string,
    default: nil,
    doc: "live view event to trigger when the delete button is clicked"

  attr :confirm_delete_text, :string, default: "Are you sure you want to remove this image?"

  attr :placeholder_icon, :string,
    default: "hero-photo-solid",
    doc: "the icon inside the placeholder image. Defaults to :photo, but you could use :user for an avatar"

  attr :rest, :global

  slot :placeholder

  def image_browser(assigns) do
    assigns =
      assigns
      |> assign_new(:new_image_class, fn -> assigns.current_image_class end)
      |> assign_new(:phx_target, fn -> assigns.rest[:"phx-target"] end)

    ~H"""
    <div class={["mb-6", @class]} phx-drop-target={@upload.ref}>
      <div class="flex flex-col gap-5 md:items-center md:flex-row">
        <div :if={@upload.entries != []} class="flex items-center gap-3">
          <div :for={entry <- @upload.entries} class="relative shrink-0">
            <.live_img_preview entry={entry} class={@new_image_class} />
            <button
              type="button"
              phx-click="cancel-upload"
              phx-target={@phx_target}
              phx-value-ref={entry.ref}
              aria-label="cancel"
              class={@delete_button_class}
            >
              <.icon name="hero-x-mark-solid" class="h-4 w-4 -mt-1" />
            </button>
          </div>
        </div>

        <div>
          <.live_file_input
            upload={@upload}
            class="block w-full text-sm rounded-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-gray-700 dark:file:text-gray-300 dark:hover:file:bg-gray-600 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 cursor-pointer"
          />

          <p :if={@automatic_help_text} class="pc-form-help-text">
            {Enum.join(@upload.acceptable_exts, ", ")}
            <%= if @upload.max_file_size do %>
              ({@max_translation} {Sizeable.filesize(@upload.max_file_size)})
            <% end %>
          </p>

          <p :if={@help_text} class="pc-form-help-text">
            {@help_text}
          </p>

          <%= for entry <- @upload.entries do %>
            <%= for err <- upload_errors(@upload, entry) do %>
              <.field_error>{error_to_string(err)}</.field_error>
            <% end %>
          <% end %>
        </div>
      </div>

      <section>
        <%= for entry <- @upload.entries do %>
          <article class="hidden mt-2 justify-items-center phx-submit-loading:block">
            <div class="flex gap-2 w-full">
              <.progress color="primary" value={entry.progress} max={100} class="grow mt-2" />

              <button
                type="button"
                phx-click="cancel-upload"
                phx-value-ref={entry.ref}
                aria-label="cancel"
              >
                &times;
              </button>
            </div>

            <p class="pc-form-help-text">
              {entry.client_name}
            </p>
          </article>
        <% end %>
      </section>
    </div>
    """
  end

  attr :class, :any, default: "h-20 w-20", doc: "classes for the image"
  attr :inner_icon_class, :string, default: "h-8 w-8", doc: "classes for the inner image icon"
  attr :inner_icon, :string, default: "hero-photo-solid"

  def dummy_image(assigns) do
    ~H"""
    <div class={[
      "flex items-center justify-center bg-gray-100 dark:bg-gray-700",
      @class
    ]}>
      <.icon name={@inner_icon} class={["text-gray-300 dark:text-gray-500", @inner_icon_class]} />
    </div>
    """
  end

  defp error_to_string(:too_large), do: gettext("File is too large")
  defp error_to_string(:not_accepted), do: gettext("You have selected an unacceptable file type")
  defp error_to_string(:too_many_files), do: gettext("You have selected too many files")
  defp error_to_string(error), do: error
end
