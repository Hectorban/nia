/*
  Will display a UTC timestamp in the user's browser's timezone

  You can pass in an optional options attribute with options JSON-encoded from:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

  <time phx-hook="LocalTimeHook" id={id} class="invisible" data-options={Jason.encode!(options)}>
    <%= date %>
  </time>

  For a HEEX component, see local_time.ex
*/
import { DateTime } from "luxon"

const LocalTimeHook = {
  mounted() {
    this.updated();
  },
  updated() {
    const format = this.el.dataset.format;
    const preset = this.el.dataset.preset;
    const locale = this.el.dataset.locale;
    const dtString = this.el.textContent.trim();
    const dt = DateTime.fromISO(dtString).setLocale(locale);

    let formatted;
    if (format) {
      if (format === "relative") {
        formatted = dt.toRelative();
      } else {
        formatted = dt.toFormat(format);
      }
    } else {
      formatted = dt.toLocaleString(DateTime[preset]);
    }

    this.el.textContent = formatted;
    this.el.classList.remove("opacity-0");
  },
};

export default LocalTimeHook;
