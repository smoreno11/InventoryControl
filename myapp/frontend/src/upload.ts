export function createUploadUI() {
  const button = document.getElementById(
    "month-all",
  ) as HTMLButtonElement | null;

  if (!button) {
    console.error("Button not found");
    return;
  }

  button.addEventListener("click", async () => {
    console.log("Button clicked");

    const input = document.createElement("input");
    input.type = "file";

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        alert("No file selected");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://127.0.0.1:8000/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log(data);

      alert("File uploaded successfully");
    };

    input.click();
  });
}
