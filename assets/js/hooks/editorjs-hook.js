import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Quote from "@editorjs/quote";
import SimpleImage from "@editorjs/simple-image";
import Table from "@editorjs/table";
import Delimiter from "@editorjs/delimiter";
import Marker from "@editorjs/marker";
import InlineCode from "@editorjs/inline-code";
import Warning from "@editorjs/warning";
import CodeTool from "@editorjs/code";
import Embed from "@editorjs/embed";
import PetalImage from "../editorjs/petal-image";

const EditorJsHook = {
  mounted() {
    const editorDiv = this.el.querySelector("div#editorjs");

    // Prevent the click event from propagating up to phx-click-away
    this.el.addEventListener("click", this.stopPropagationClick);

    this.handleEvent("select_file", (file_params) =>
      PetalImage.handleSelectFile(this.editor, file_params),
    );

    this.editor = new EditorJS({
      holder: editorDiv,
      minHeight: 0,
      placeholder: this.el.dataset.placeholder,
      tools: {
        header: Header,
        quote: Quote,
        marker: Marker,
        inlineCode: InlineCode,
        delimiter: Delimiter,
        list: {
          class: List,
          inlineToolbar: true,
        },
        image: SimpleImage,
        petalImage: PetalImage,
        table: Table,
        warning: Warning,
        code: CodeTool,
        embed: {
          class: Embed,
          config: {
            services: {
              youtube: true,
              twitter: {
                regex:
                  /^https?:\/\/(www\.)?(?:twitter\.com|x\.com)\/.+\/status\/(\d+)/,
                embedUrl:
                  "https://platform.twitter.com/embed/Tweet.html?id=<%= remote_id %>",
                html: '<iframe width="300" height="500" class="mx-auto" frameborder="0" allowtransparency="true"></iframe>',
                height: 500,
                width: 300,
                id: (ids) => ids[1],
              },
            },
          },
        },
      },
      onReady: () => {
        this.load();
      },
      onChange: () => {
        this.editor
          .save()
          .then((outputData) => {
            const hiddenInput = this.el.querySelector("input[type=hidden]");
            hiddenInput.value = JSON.stringify(outputData);

            // Input event will cause form to run validation. Debounce setting is
            // controlled by `phx-debounce` on hidden input
            hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
          })
          .catch((error) => {
            console.log("Saving failed: ", error);
          });
      },
    });
  },

  updated() {
    // this.load()
  },

  destroyed() {
    const editorDiv = this.el.querySelector("div#editorjs");
    editorDiv.removeEventListener("click", this.stopPropagationClick);

    // Clean up the Editor.js instance when the hook is destroyed
    if (this.editor) {
      this.editor.destroy();
    }
  },

  stopPropagationClick(event) {
    // Adjust for unhandled events from Editor.js that cause `phx-click-away` to fire
    const insideToolbar = event.target.closest(".ce-toolbar") !== null;
    const insidePopover = event.target.closest(".ce-popover") !== null;
    const orphaned = event.target.parentNode === null;

    if (insideToolbar || insidePopover || orphaned) {
      event.stopPropagation();
    }
  },

  load() {
    const hiddenInput = this.el.querySelector("input[type=hidden]");

    if (hiddenInput.value) {
      console.log(hiddenInput.value);
      const json = JSON.parse(hiddenInput.value);

      this.editor.render(json);
    }
  },
};

export default EditorJsHook;
