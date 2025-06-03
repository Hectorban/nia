import TomSelect from "tom-select";

const ComboBoxHook = {
  mounted() {
    this.init(this.el);
  },
  updated() {
    const el = this.el;

    // If the options have changed, destroy the TomSelect instance and re-initialize it with the new options.
    const latestSelect = el.querySelector("select.combo-box-latest");
    const initialSelect = el.querySelector("select.combo-box");

    const maybeRemoteOptionsEventName = el.dataset.remoteOptionsEventName;

    // combo boxes using remote options require this assignment
    // but it breaks standard combo boxes using multiple selection
    // which require the other assignment - go figure!
    if (maybeRemoteOptionsEventName) {
      latestSelect.value = initialSelect.value;
    } else {
      initialSelect.value = latestSelect.value;
    }

    let latestOptions = latestSelect.querySelectorAll("option");
    let initialOptions = initialSelect.querySelectorAll("option");

    // Convert latestOptions and initialOptions to arrays
    let latestOptionsArray = Array.from(latestOptions);
    let initialOptionsArray = Array.from(initialOptions);

    // Sort the arrays by their values
    latestOptionsArray.sort((a, b) => a.value.localeCompare(b.value));
    initialOptionsArray.sort((a, b) => a.value.localeCompare(b.value));

    if (latestOptionsArray && initialOptionsArray) {
      // If the options have changed, destroy the TomSelect instance and re-initialize it with the new options.
      if (latestOptionsArray.length !== initialOptionsArray.length) {
        this.reInit();
      } else {
        for (let i = 0; i < latestOptionsArray.length; i++) {
          const latestOption = latestOptionsArray[i];
          const initialOption = initialOptionsArray[i];

          if (
            latestOption.label !== initialOption.label ||
            latestOption.value !== initialOption.value
          ) {
            this.reInit();
            break;
          }
        }
      }

      for (let i = 0; i < latestOptionsArray.length; i++) {
        const latestOption = latestOptionsArray[i];
        const initialOption = initialOptionsArray[i];

        if (initialOption && latestOption.selected !== initialOption.selected) {
          initialOption.selected = latestOption.selected;
        }
      }
    }
  },
  reInit() {
    const latestSelect = this.el.querySelector("select.combo-box-latest");
    const initialSelect = this.el.querySelector("select.combo-box");

    initialSelect.innerHTML = latestSelect.innerHTML;
    this.init(this.el);
  },
  async init(el) {
    if (el.tomSelect) {
      el.tomSelect.destroy();
      el.tomSelect = null;
    }

    const remoteOptionsTarget = el.dataset.remoteOptionsTarget;
    const options = JSON.parse(el.dataset.options);
    const plugins = JSON.parse(el.dataset.plugins);
    const globalOpts = window[el.dataset.globalOptions];
    const selectEl = el.querySelector("select.combo-box");
    const remoteOptionsEventName = el.dataset.remoteOptionsEventName;

    const tomSelectOptions = {
      plugins,
      ...options,
      ...globalOpts,
    };

    if (remoteOptionsEventName) {
      tomSelectOptions.load = (query, callback) => {
        const handleServerReply = (payload, ref) => {
          const resultsJSON = payload.results.map(({ text, value }) => ({
            text,
            value,
          }));

          callback(resultsJSON);
        };

        // This calls the Phoenix Live View. Expects the results in this format: %{results: [{text: "text", value: "value"}]
        if (remoteOptionsTarget) {
          this.pushEventTo(
            remoteOptionsTarget,
            remoteOptionsEventName,
            query,
            handleServerReply,
          );
        } else {
          this.pushEvent(remoteOptionsEventName, query, handleServerReply);
        }
      };
    }

    el.tomSelect = new TomSelect(selectEl, tomSelectOptions);

    el.querySelector(".combo-box-wrapper").classList.remove("opacity-0");
  },
};

export default ComboBoxHook;
