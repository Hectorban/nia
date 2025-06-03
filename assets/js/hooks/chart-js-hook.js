// https://hexdocs.pm/phoenix_live_view/js-interop.html#client-hooks
// Note: when using phx-hook, a unique DOM ID must always be set.

import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import autocolors from "chartjs-plugin-autocolors";

Chart.register(autocolors);

const ChartJsHook = {
  mounted() {
    const chartOptions = JSON.parse(this.el.dataset.chartOptions);
    const autocolorEnabled = this.el.dataset.autocolor === "true";
    const yLabelFormat = this.el.dataset.yLabelFormat;

    chartOptions.options.plugins ||= {};
    chartOptions.options.plugins.autocolors ||= {};
    chartOptions.options.plugins.autocolors.enabled = autocolorEnabled;

    chartOptions.options ||= {};
    chartOptions.options.scales ||= {};
    chartOptions.options.scales.y ||= {};
    chartOptions.options.scales.y.ticks ||= {};
    chartOptions.options.scales.y.ticks.callback = function (
      value,
      _index,
      _ticks
    ) {
      return formatValue(value, yLabelFormat);
    };

    // Create the chart
    const context = this.el.querySelector("canvas").getContext("2d");

    const createGradient = (context, colors) => {
      const gradient = context.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, colors.from);
      gradient.addColorStop(1, colors.to);
      return gradient;
    };

    // Apply gradients to datasets if specified
    if (chartOptions.data && chartOptions.data.datasets) {
      chartOptions.data.datasets = chartOptions.data.datasets.map((dataset) => {
        if (dataset.useGradient && chartOptions.type === "line") {
          return {
            ...dataset,
            backgroundColor: createGradient(context, {
              from: dataset.gradientFrom,
              to: dataset.gradientTo,
            }),
          };
        }
        return dataset;
      });
    }

    const chart = new Chart(context, chartOptions);

    const event = this.el.dataset.event;
    if (event) {
      window.addEventListener("phx:" + event, (e) => {
        const updatedDatasets = e.detail.datasets.map((dataset) => {
          if (dataset.useGradient && chartOptions.type === "line") {
            return {
              ...dataset,
              backgroundColor: createGradient(context, {
                from: dataset.gradientFrom,
                to: dataset.gradientTo,
              }),
            };
          }
          return dataset;
        });
        chart.data.datasets = updatedDatasets;
        chart.data.labels = e.detail.labels;
        chart.update();
      });
    }
  },
};

function formatValue(value, format) {
  switch (format) {
    case "dollars":
      return formatDollars(value);
      break;
    case "percent":
      return numberWithCommas(value) + "%";
      break;
    default:
      return numberWithCommas(value);
  }
}

function formatDollars(value) {
  return Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumSignificantDigits: 3,
    notation: "compact",
  }).format(value);
}

function numberWithCommas(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default ChartJsHook;
