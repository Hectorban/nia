defmodule NiaWeb.BorderBeam do
  @moduledoc """
  A border beam component that creates an animated beam effect along the border
  of its container using CSS mask/offset-path techniques.
  """
  use Phoenix.Component

  attr :gradient_color_start, :string, default: "#ffaa40", doc: "The starting color of the beam"
  attr :gradient_color_end, :string, default: "#9c40ff", doc: "The ending color of the beam"
  attr :border_radius, :string, default: "0.5rem", doc: "The container's border radius"
  attr :border_color, :string, default: "hsl(240, 3.9%, 15.1%)", doc: "The container's border color"
  attr :animation_duration, :string, default: "12s", doc: "Duration of the beam animation"
  attr :offset_distance, :string, default: "0%", doc: "The starting position of the beam"
  attr :beam_size, :string, default: "150px", doc: "Size of the beam effect"
  attr :class, :string, default: ""
  attr :rest, :global

  slot :inner_block

  def border_beam(assigns) do
    assigns =
      assign(
        assigns,
        :style,
        " --color-from: #{assigns.gradient_color_start};" <>
          " --color-to: #{assigns.gradient_color_end};" <>
          " --border-radius: #{assigns.border_radius};" <>
          " --border-color: #{assigns.border_color};" <>
          " --animation-duration: #{assigns.animation_duration};" <>
          " --offset-distance: #{assigns.offset_distance};" <>
          " --beam-size: #{assigns.beam_size};"
      )

    ~H"""
    <div class="border-beam-wrapper" {@rest}>
      <div class={"border-beam #{@class}"} style={@style}>
        <div class="border-beam-border"></div>
        {render_slot(@inner_block)}
      </div>
    </div>
    """
  end
end
