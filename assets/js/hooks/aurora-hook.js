/**
 * Phoenix LiveView Hook for the Aurora component
 * This handles the intersection observer to pause animations when the element is not visible
 */
const Aurora = {
  mounted() {
    this.isInView = false;
    this.auroraElement = this.el.querySelector("[data-aurora-element]");

    if ("IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(
        this.handleIntersection.bind(this)
      );
      this.observer.observe(this.el);
    } else {
      // Fallback for browsers that don't support IntersectionObserver
      this.isInView = true;
    }
  },

  handleIntersection(entries) {
    const [entry] = entries;

    if (entry.isIntersecting) {
      if (!this.isInView) {
        this.isInView = true;
        this.auroraElement.classList.remove("out-of-view");
      }
    } else if (this.isInView) {
      this.isInView = false;
      this.auroraElement.classList.add("out-of-view");
    }
  },

  destroyed() {
    if (this.observer) {
      this.observer.disconnect();
    }
  },
};

// Export for use in hooks.js
export default Aurora;
