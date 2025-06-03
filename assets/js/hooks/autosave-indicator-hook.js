const AutosaveIndicator = {
  mounted() {
    // Start with opacity 0
    this.el.style.opacity = "0";

    // Trigger fade in on next frame
    requestAnimationFrame(() => {
      this.el.style.opacity = "1";
    });

    // For saved status (not saving), setup fade out
    if (this.el.id === "saved") {
      // Wait 3 seconds then fade out
      setTimeout(() => {
        this.el.style.opacity = "0";
        // Remove element after fade completes
        setTimeout(() => {
          this.el.remove();
        }, 300); // matches duration-300
      }, 3000);
    }
  },
};

export default AutosaveIndicator;
