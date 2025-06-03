const FocusBySelectorHook = {
  mounted() {
    this.handleEvent("focus", (params) => {
      let el = this.el.querySelector(params.selector)
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    })
  }
}

export default FocusBySelectorHook;