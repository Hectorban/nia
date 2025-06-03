/* Add this hook to textareas
  As a user types in a textarea, it expands or retracts automatically. eg:

  <.form_field
    type="textarea"
    form={f}
    field={:description}
    phx-hook="ResizeTextareaHook"
  />
*/
const ResizeTextareaHook = {
  mounted() {
    autosize(this.el);
  },
  updated() {
    autosize(this.el);
  },
};

function autosize(element) {
  element.style.boxSizing = "border-box";
  var offset = element.offsetHeight - element.clientHeight;
  element.addEventListener("input", function (event) {
    event.target.style.height = "auto";
    event.target.style.height = event.target.scrollHeight + offset + "px";
  });
  element.style.height = element.scrollHeight + offset + "px";
  element.removeAttribute("data-autoresize");
}

export default ResizeTextareaHook;
