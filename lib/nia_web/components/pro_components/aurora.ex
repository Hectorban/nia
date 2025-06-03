defmodule NiaWeb.Aurora do
  @moduledoc """
  An aurora component that creates a colorful aurora effect in the background
  of its container using CSS gradients and animations.
  """
  use Phoenix.Component

  attr :invert, :boolean, default: false, doc: "Whether to invert the aurora colors"
  attr :background_gradient, :string, default: nil, doc: "Gradient to use as background"
  attr :aurora_gradient, :string, default: nil, doc: "Custom aurora gradient"
  attr :animation_duration, :string, default: "60s", doc: "Duration of the animation in seconds"
  attr :opacity, :string, default: "0.5", doc: "Opacity of the aurora effect"
  attr :blur, :string, default: "10px", doc: "Amount of blur applied to the effect"
  attr :mask_position, :string, default: "100% 0", doc: "Position of the radial mask"
  attr :mask_coverage, :string, default: "10%, 70%", doc: "Coverage of the radial mask"
  attr :class, :string, default: ""
  attr :rest, :global

  slot :inner_block

  def aurora(assigns) do
    assigns =
      assign(
        assigns,
        :style,
        build_style(assigns)
      )

    ~H"""
    <div class={"aurora #{@class}"} style={@style} phx-hook="Aurora" {@rest}>
      <div class="aurora-background">
        <div class="aurora-lights" data-aurora-element></div>
      </div>
      {render_slot(@inner_block)}
    </div>
    """
  end

  defp build_style(assigns) do
    # Default gradients
    default_dark_gradient =
      "repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%)"

    default_aurora_gradient =
      "repeating-linear-gradient(100deg, #3b82f6 10%, #a5b4fc 15%, #93c5fd 20%, #ddd6fe 25%, #60a5fa 30%)"

    Enum.join(
      [
        if(assigns.invert, do: "--aurora-invert: invert(1);", else: "--aurora-invert: invert(0);"),
        "--aurora: #{assigns.aurora_gradient || default_aurora_gradient};",
        "--dark-gradient: #{assigns.background_gradient || default_dark_gradient};",
        "animation-duration: #{assigns.animation_duration};",
        "--aurora-opacity: #{assigns.opacity};",
        "--aurora-blur: #{assigns.blur};",
        "--mask-position: #{assigns.mask_position};",
        "--mask-coverage: #{assigns.mask_coverage};"
      ],
      " "
    )
  end
end
