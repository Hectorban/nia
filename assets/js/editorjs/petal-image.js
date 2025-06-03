export default class PetalImage {
  static get toolbox() {
    return {
      title: "Image",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"></svg>',
    };
  }

  static async handleSelectFile(editor, file_params) {
    const { url, name } = file_params;

    const block = await editor.save().then((savedData) => {
      const block_id = file_params["image-target"];

      return savedData.blocks.find((block) => block.id === block_id);
    });

    if (block) {
      const data = {
        ...block.data,
        url: url,
        caption: name,
      };

      editor.blocks.update(block.id, data);
    }
  }

  constructor({ data, block }) {
    this.data = data;
    this.block = block;
    this.wrapper = undefined;
  }

  render() {
    console.log(this.data);

    this.wrapper = document.createElement("div");
    this.wrapper.classList.add("simple-image");

    if (this.data && this.data.url) {
      const imageAndCaption = this._createImage(
        this.data.url,
        this.data.caption,
      );

      this.wrapper.append(...imageAndCaption);
    } else {
      const placeholder = this._createPlaceholder();

      this.wrapper.append(placeholder);
    }

    return this.wrapper;
  }

  _createImage(url, captionText) {
    const image = document.createElement("img");
    image.src = url;
    image.classList.add("petal-image");
    image.setAttribute("phx-click", "show_files");
    image.setAttribute("phx-value-image-target", this.block.id);

    const caption = document.createElement("input");
    caption.placeholder = "Caption...";
    caption.value = captionText || "";
    caption.classList.add("petal-image-input");
    caption.setAttribute("type", "text");

    return [image, caption];
  }

  _createPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.classList.add("petal-image-placeholder");
    placeholder.setAttribute("phx-click", "show_files");
    placeholder.setAttribute("phx-value-image-target", this.block.id);

    const icon = document.createElement("span");
    icon.classList.add("hero-photo");
    icon.classList.add("petal-image-placeholder-icon");

    placeholder.appendChild(icon);

    return placeholder;
  }

  save(blockContent) {
    const image = blockContent.querySelector("img");
    const src = image ? image.src : "";

    const caption = blockContent.querySelector("input");
    const captionValue = caption ? caption.value : "";

    return {
      url: src,
      caption: captionValue,
    };
  }

  // validate(savedData) {
  //   console.log(savedData);
  //   if (!savedData.url.trim()) {
  //     return false;
  //   }

  //   return true;
  // }
}
