const convertBtn = document.getElementById("convertBtn");
const imageInput = document.getElementById("imageInput");
const formatSelect = document.getElementById("formatSelect");
const statusMessage = document.getElementById("statusMessage");


convertBtn.addEventListener("click", () => {

    if (!imageInput.files || !imageInput.files[0]) {

        showStatus(
            "Please select an image file first.",
            "error"
        );

        return;
    }


    const file = imageInput.files[0];
    const format = formatSelect.value;


    showStatus(
        "Converting your image...",
        "success"
    );


    const reader = new FileReader();


    reader.onload = (event) => {

        const img = new Image();


        img.onload = () => {

            /*
             * Create an off-screen canvas
             * for image conversion.
             */

            const canvas = document.createElement("canvas");

            canvas.width = img.width;
            canvas.height = img.height;


            const ctx = canvas.getContext("2d");


            /*
             * JPEG does not support transparency.
             * Therefore transparent areas become white.
             */

            if (format === "image/jpeg") {

                ctx.fillStyle = "#FFFFFF";

                ctx.fillRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
            }


            ctx.drawImage(
                img,
                0,
                0
            );


            /*
             * Convert canvas to selected format.
             */

            canvas.toBlob(
                (blob) => {

                    if (!blob) {

                        showStatus(
                            "Unable to convert this image.",
                            "error"
                        );

                        return;
                    }


                    const extension =
                        format.split("/")[1];


                    /*
                     * Remove the original extension
                     * and add the new extension.
                     */

                    const lastDot =
                        file.name.lastIndexOf(".");


                    const originalName =
                        lastDot !== -1
                            ? file.name.substring(0, lastDot)
                            : file.name;


                    const fileName =
                        `${originalName}.${extension}`;


                    /*
                     * Create temporary download URL.
                     */

                    const downloadUrl =
                        URL.createObjectURL(blob);


                    const downloadLink =
                        document.createElement("a");


                    downloadLink.href =
                        downloadUrl;

                    downloadLink.download =
                        fileName;


                    document.body.appendChild(
                        downloadLink
                    );


                    downloadLink.click();


                    downloadLink.remove();


                    /*
                     * Clean up temporary URL.
                     */

                    setTimeout(() => {

                        URL.revokeObjectURL(
                            downloadUrl
                        );

                    }, 100);


                    showStatus(
                        `Done! Your ${extension.toUpperCase()} image has been downloaded.`,
                        "success"
                    );

                },
                format,
                0.92
            );
        };


        img.onerror = () => {

            showStatus(
                "The selected file is not a valid image.",
                "error"
            );
        };


        img.src =
            event.target.result;
    };


    reader.onerror = () => {

        showStatus(
            "Unable to read the selected file.",
            "error"
        );
    };


    reader.readAsDataURL(file);

});


/* =========================
   STATUS MESSAGE
========================= */

function showStatus(message, type) {

    statusMessage.textContent =
        message;

    statusMessage.className =
        `status-message show ${type}`;
}


/* =========================
   MOBILE NAVIGATION
========================= */

const menuButton =
    document.getElementById("menuButton");

const navLinks =
    document.getElementById("navLinks");


menuButton.addEventListener("click", () => {

    navLinks.classList.toggle("active");

});


/*
 * Close mobile menu when
 * a navigation link is clicked.
 */

document
    .querySelectorAll(".nav-links a")
    .forEach((link) => {

        link.addEventListener("click", () => {

            navLinks.classList.remove("active");

        });

    });


/* =========================
   FAQ ACCORDION
========================= */

const faqItems =
    document.querySelectorAll(".faq-item");


faqItems.forEach((item) => {

    const question =
        item.querySelector(".faq-question");


    question.addEventListener("click", () => {

        /*
         * Close other FAQ items.
         */

        faqItems.forEach((otherItem) => {

            if (otherItem !== item) {

                otherItem.classList.remove(
                    "active"
                );

            }

        });


        /*
         * Toggle selected FAQ.
         */

        item.classList.toggle("active");

    });

});


/* =========================
   CURRENT YEAR
========================= */

document.getElementById("year").textContent =
    new Date().getFullYear();
