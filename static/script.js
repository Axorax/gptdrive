const s = {
  tokenModal: document.querySelector("#token-modal"),
  tokenModalP: document.querySelector("#token-modal p"),
};

let convo = "";

function check() {
  fetch("/isTokenPresent")
    .then((res) => res.json())
    .then((data) => {
      if (data) {
        fetch("/tokenReadRequest").then((_) => {
          fetch("/chats")
            .then((res) => res.json())
            .then((data) => {
              showDrivesInSidebar(data);
            });
        });
        return;
      }
      s.tokenModal.classList.add("active");
    });
}

check();

function showDrivesInSidebar(data) {
  data.items.forEach((item) => {
    document.querySelector(
      ".drives-container ul",
    ).innerHTML += `<li onclick="loadDrive('${item.id}')">${item.title}</li>`;
  });
}

function loadDrive(e) {
  convo = e;
  fetch(`/drive/${convo}`)
    .then((res) => res.json())
    .then((data) => {
      document.querySelector(".main ul").innerHTML = "";
      Object.keys(data).forEach((key) => {
        const x = data[key][0].split(".");
        const y = (data[key][1] / 1e6).toFixed(2);
        document.querySelector(".main ul").innerHTML += `
            <li>
            <p class="name">${data[key][0]}</p>
            <p><span>extension</span><span>${x[x.length - 1]}</span></p>
            <p><span>size</span><span>${
              y == 0.0 ? data[key][1] + "kb" : y + "mb"
            }</span></p>
            <button onclick="download('${convo}', '${key}', '${
              data[key][0]
            }')">download</button>
        </li>
            `;
      });
    });
}

function download(convo, id, name) {
  fetch(`download/${convo}/${id}/${name}`);
}

function uploadFile(e) {
  const x = document.querySelector(".upload-modal .uploadBox p");
  e.preventDefault();
  const files = e.type === "change" ? e.target.files : e.dataTransfer.files;

  if (files.length === 0) {
    return;
  }

  const file = files[0];

  if (!file) {
    console.error("No file selected");
    return;
  }

  x.innerText = "Uploading...";

  const reader = new FileReader();

  reader.onload = function (event) {
    const fileContent = event.target.result;

    const formData = {
      file: fileContent,
      convo: convo,
      name: file.name,
      size: file.size,
    };

    fetch("/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success == true) {
          x.innerText = "Server received file and has started uploading!";
          setTimeout(() => {
            x.innerText = "Drag and drop";
            openUploadModal();
          }, 2000);
        }
      })
      .catch((error) => {
        console.error("Fetch error:", error);
      });
  };

  reader.readAsText(file);
}

function openUploadModal() {
  const u = document.querySelector(".upload-modal");
  const o = document.querySelector(".overlay");
  if (u.classList.contains("active")) {
    u.classList.remove("active");
    o.classList.remove("active");
  } else {
    u.classList.add("active");
    o.classList.add("active");
  }
}

function allowDrop(event) {
  event.preventDefault();
  document.body.classList.add("dragging");
}

function dragLeave() {
  document.body.classList.remove("dragging");
}

document.querySelectorAll(".dropzone").forEach((zone) => {
  zone.addEventListener("drop", uploadFile);
  zone.addEventListener("dragover", allowDrop);
  zone.addEventListener("dragleave", dragLeave);
});

function setToken() {
  const token = document.querySelector("#token-input").value;
  fetch("/setToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: token,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error == true) {
        s.tokenModalP.innerHTML = `<span style="color:red">Invalid token!</span>`;
      } else {
        s.tokenModal.classList.remove("active");
        check();
      }
    });
}

function searchDrives(e) {
  const value = e.value.toLowerCase();
  document.querySelectorAll(".drives-container ul li").forEach((i) => {
    if (i.innerText.toLowerCase().includes(value)) {
      i.style.display = "block";
    } else {
      i.style.display = "none";
    }
  });
}

function searchFiles(e) {
  const v = e.value.toLowerCase();
  document.querySelectorAll(".main ul li").forEach((x) => {
    const i = x.querySelector(".name");
    if (i.innerText.toLowerCase().includes(v)) {
      x.style.display = "block";
    } else {
      x.style.display = "none";
    }
  });
}
