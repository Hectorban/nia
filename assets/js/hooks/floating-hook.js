import {autoUpdate, computePosition, offset} from '@floating-ui/dom';

const FloatingHook = {
  mounted() {
    this.run("mounted");
  },
  updated() {
    this.run("updated");
  },
  destroyed() {
    const hook = this;
    if (typeof hook.cleanup === "function") {
      hook.cleanup();
    }
  },
  run(lifecycle) {
    const hook = this;
    const floatingEl = hook.el;

    const attachToEl = document.getElementById(floatingEl.dataset.attachToId);
    const showOnMount = floatingEl.dataset.showOnMount;

    // hydrate offset options once if they exist
    if (
    floatingEl.dataset.floatOffset &&
    hook.floatOffsetOpts === undefined
    ) {
    hook.floatOffsetOpts = JSON.parse(floatingEl.dataset.floatOffset);
    }

    if (attachToEl) {
    const middleware = hook.floatOffsetOpts
        ? [offset(hook.floatOffsetOpts)]
        : [];
    const floatOpts = {
        placement: floatingEl.dataset.placement || "right-start",
        middleware,
    };

    const updatePosition = () =>
        computePosition(attachToEl, floatingEl, floatOpts).then(
        ({ x, y }) => {
            Object.assign(floatingEl.style, {
            left: `${x}px`,
            top: `${y}px`,
            });
        },
        );

    updatePosition();

    if (lifecycle === "mounted" && showOnMount === "true") {
        floatingEl.classList.remove("hidden");
    }

    // When the floating element is open on the screen
    hook.cleanup = autoUpdate(attachToEl, floatingEl, updatePosition);
    }
  },
};

export default FloatingHook;
