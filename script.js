"use strict";


/* =========================================
   GLOBAL STATE
========================================= */

let db = null;

let currentPhotoId = null;
let currentPhotoData = null;
let currentPhotoCard = null;

let viewerFlipped = false;
let isClosingViewer = false;

let previousObjectURL = null;

let deletePhotoButton = null;
let deleteArmed = false;

/* =========================================
   DATABASE CONFIGURATION
========================================= */

const DB_NAME = "memoryAlbum";
const DB_VERSION = 1;
const STORE_NAME = "photos";


/* =========================================
   AGING CONFIGURATION
========================================= */

const AGING_STORAGE_KEY = "photoAging";

let photoAging = {};


/* =========================================
   RANDOM MEMORY CONFIGURATION
========================================= */

/*
    Guarda a última memória encontrada
    pelo álbum.

    Isso impede que a mesma fotografia
    seja escolhida duas vezes seguidas.
*/

const RANDOM_MEMORY_STORAGE_KEY =
    "albumRandomMemory";

let lastRandomPhotoId = null;


/* =========================================
   AGING THRESHOLDS
========================================= */

const AGE_THRESHOLDS = {

    level1: 5,

    level2: 10,

    level3: 15,

    level4: 20,

    level5: 30

};


/* =========================================
   LOAD AGING STORAGE
========================================= */

try {

    const storedAging =
        localStorage.getItem(
            AGING_STORAGE_KEY
        );


    if (storedAging) {

        photoAging =
            JSON.parse(
                storedAging
            ) || {};

    }

} catch (error) {

    console.warn(
        "Não foi possível carregar o envelhecimento das fotografias.",
        error
    );

    photoAging = {};

}


/* =========================================
   LOAD RANDOM MEMORY STORAGE
========================================= */

try {

    lastRandomPhotoId =
        localStorage.getItem(
            RANDOM_MEMORY_STORAGE_KEY
        );

} catch (error) {

    console.warn(
        "Não foi possível carregar a última memória escolhida.",
        error
    );

    lastRandomPhotoId = null;

}


/* =========================================
   DOM ELEMENTS
========================================= */


/* Cover */

const albumCover =
    document.getElementById(
        "albumCover"
    );

const gallery =
    document.getElementById(
        "gallery"
    );

const openAlbum =
    document.getElementById(
        "openAlbum"
    );

const photoContainer =
    document.getElementById(
        "photoContainer"
    );


/* Viewer */

const photoViewer =
    document.getElementById(
        "photoViewer"
    );

const viewerPhoto =
    document.getElementById(
        "viewerPhoto"
    );

const viewerImage =
    document.getElementById(
        "viewerImage"
    );

const viewerDate =
    document.getElementById(
        "viewerDate"
    );

let viewerText =
    document.getElementById(
        "viewerText"
    );

const viewerLocation =
    document.getElementById(
        "viewerLocation"
    );

const viewerBack =
    viewerPhoto.querySelector(
        ".viewer-photo-back"
    );

let backNoteEditor = null;

const closeViewerButton =
    document.getElementById(
        "closeViewer"
    );

const restorePhotoButton =
    document.getElementById(
        "restorePhoto"
    );


/* Flash */

const cameraFlash =
    document.getElementById(
        "cameraFlash"
    );


/* Form */

const addMemoryButton =
    document.getElementById(
        "addMemoryButton"
    );

const memoryFormOverlay =
    document.getElementById(
        "memoryFormOverlay"
    );

const closeMemoryFormButton =
    document.getElementById(
        "closeMemoryForm"
    );

const memoryForm =
    document.getElementById(
        "memoryForm"
    );

const photoInput =
    document.getElementById(
        "photoInput"
    );

const memoryDate =
    document.getElementById(
        "memoryDate"
    );

const memoryLocation =
    document.getElementById(
        "memoryLocation"
    );

const memoryText =
    document.getElementById(
        "memoryText"
    );


/* =========================================
   UTILITY
========================================= */

function wait(
    milliseconds
) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


/* =========================================
   AGING STATE
========================================= */

/* =========================================
   AGING STATE
========================================= */

function createAgingState() {

    return {

        opens: 0,
        level: 0,

        // Deterioração física que nunca é restaurada.
        permanent: 0,

        // Desgaste causado pelo manuseio e restaurável.
        stains: 0,
        fading: 0,
        scratches: 0,
        yellowing: 0,

        // Marcas permanentes individuais.
        permanentStains: [],

        // Envelhecimento cronológico.
        naturalAge: 0,
        ageYears: 0

    };

}


/* =========================================
   CLAMP
========================================= */

function clamp(
    value,
    minimum = 0,
    maximum = 1
) {

    return Math.min(
        maximum,
        Math.max(
            minimum,
            Number(value) || 0
        )
    );

}


/* =========================================
   GET AGE LEVEL
========================================= */

function getAgeLevel(
    openCount
) {

    const count =
        Number(
            openCount
        ) || 0;


    if (
        count >=
        AGE_THRESHOLDS.level5
    ) {

        return 5;

    }


    if (
        count >=
        AGE_THRESHOLDS.level4
    ) {

        return 4;

    }


    if (
        count >=
        AGE_THRESHOLDS.level3
    ) {

        return 3;

    }


    if (
        count >=
        AGE_THRESHOLDS.level2
    ) {

        return 2;

    }


    if (
        count >=
        AGE_THRESHOLDS.level1
    ) {

        return 1;

    }


    return 0;

}


/* =========================================
   NORMALIZE AGING STATE
========================================= */

function normalizeAgingState(
    state
) {

    const normalized =
        createAgingState();

    if (
        !state ||
        typeof state !== "object"
    ) {
        return normalized;
    }

    normalized.opens = Math.max(
        0,
        Number(state.opens) || 0
    );

    normalized.level = getAgeLevel(
        normalized.opens
    );

    normalized.permanent = clamp(
        state.permanent,
        0,
        0.85
    );

    normalized.stains = clamp(
        state.stains,
        0,
        0.65
    );

    normalized.fading = clamp(
        state.fading,
        0,
        0.55
    );

    normalized.scratches = clamp(
        state.scratches,
        0,
        0.60
    );

    normalized.yellowing = clamp(
        state.yellowing,
        0,
        0.50
    );

    normalized.naturalAge = clamp(
        state.naturalAge,
        0,
        1
    );

    normalized.ageYears = Math.max(
        0,
        Number(state.ageYears) || 0
    );

    normalized.permanentStains =
        Array.isArray(state.permanentStains)
            ? state.permanentStains
                .map(Number)
                .filter(value => [1, 2, 3].includes(value))
                .filter((value, index, array) => array.indexOf(value) === index)
                .sort((a, b) => a - b)
            : [];

    return normalized;

}


/* =========================================
   CONVERT OLD AGING FORMAT
========================================= */

/*
    Mantém compatibilidade com fotografias
    que já possuíam um contador antigo.
*/

function convertLegacyAging(
    oldCount
) {

    const count =
        Math.max(
            0,
            Number(
                oldCount
            ) || 0
        );


    const state =
        createAgingState();


    state.opens =
        count;


    state.level =
        getAgeLevel(
            count
        );


    /*
        Estes valores representam o antigo
        desgaste causado pelo manuseio.

        A idade natural será adicionada
        separadamente pela data da foto.
    */

    state.yellowing =
        clamp(
            Math.max(
                0,
                (count - 2) *
                0.012
            ),
            0,
            0.50
        );


    state.fading =
        clamp(
            Math.max(
                0,
                (count - 4) *
                0.010
            ),
            0,
            0.55
        );


    state.stains =
        clamp(
            Math.max(
                0,
                (count - 5) *
                0.014
            ),
            0,
            0.65
        );


    state.scratches =
        clamp(
            Math.max(
                0,
                (count - 10) *
                0.010
            ),
            0,
            0.60
        );


    state.permanent =
        clamp(
            Math.max(
                0,
                (count - 12) *
                0.018
            ),
            0,
            0.75
        );

    if (count >= 15) state.permanentStains.push(1);
    if (count >= 25) state.permanentStains.push(2);
    if (count >= 40) state.permanentStains.push(3);


    return state;

}


/* =========================================
   CALCULATE NATURAL PHOTO AGE
========================================= */

/*
    Calcula a idade real da fotografia
    usando a data em que ela foi tirada.

    A intensidade máxima acontece aos
    80 anos.

    Exemplos:

        0 anos  → 0.00
        10 anos → 0.125
        20 anos → 0.25
        40 anos → 0.50
        60 anos → 0.75
        80+     → 1.00
*/

function calculateNaturalPhotoAge(
    photoDate
) {

    if (!photoDate) {

        return {

            years: 0,

            intensity: 0

        };

    }


    const parts =
        String(
            photoDate
        ).split("-");


    if (
        parts.length !== 3
    ) {

        return {

            years: 0,

            intensity: 0

        };

    }


    const year =
        Number(
            parts[0]
        );


    const month =
        Number(
            parts[1]
        );


    const day =
        Number(
            parts[2]
        );


    const taken =
        new Date(
            year,
            month - 1,
            day
        );


    if (
        Number.isNaN(
            taken.getTime()
        )
    ) {

        return {

            years: 0,

            intensity: 0

        };

    }


    const now =
        new Date();


    const ageMilliseconds =
        Math.max(
            0,
            now.getTime() -
            taken.getTime()
        );


    const years =
        ageMilliseconds /
        (
            1000 *
            60 *
            60 *
            24 *
            365.25
        );


    const intensity =
        clamp(
            years / 80,
            0,
            1
        );


    return {

        years,

        intensity

    };

}


/* =========================================
   APPLY NATURAL AGING
========================================= */

/*
    Aplica o envelhecimento causado
    exclusivamente pela idade da fotografia.

    IMPORTANTE:

    A idade cronológica NÃO cria riscos
    físicos nem dano permanente.

    Ela afeta principalmente:

        - amarelamento
        - desbotamento
        - manchas naturais
*/

function applyNaturalAging(
    state,
    photoDate
) {

    const age =
        calculateNaturalPhotoAge(
            photoDate
        );

    state.ageYears = age.years;
    state.naturalAge = age.intensity;

    return state;

}


/* =========================================
   GET AGING STATE
========================================= */

function getAgingState(
    id,
    photoData = null
) {

    const key =
        String(id);


    /*
        Compatibilidade com o formato antigo,
        onde photoAging[id] era apenas um número.
    */

    if (
        typeof photoAging[key] ===
        "number"
    ) {

        photoAging[key] =
            convertLegacyAging(
                photoAging[key]
            );


        saveAging();

    }


    /*
        Cria estado caso ainda não exista.
    */

    if (
        !photoAging[key] ||
        typeof photoAging[key] !==
        "object"
    ) {

        photoAging[key] =
            createAgingState();

    }


    /*
        Normaliza o estado.
    */

    photoAging[key] =
        normalizeAgingState(
            photoAging[key]
        );


    /*
        Recalcula a idade natural sempre
        que temos acesso aos dados da foto.

        Isso é importante porque a fotografia
        envelhece mesmo quando ninguém abre o álbum.
    */

    if (
        photoData &&
        photoData.date
    ) {

        applyNaturalAging(
            photoAging[key],
            photoData.date
        );

    }


    return photoAging[key];

}


/* =========================================
   SAVE AGING
========================================= */

function saveAging() {

    try {

        localStorage.setItem(
            AGING_STORAGE_KEY,
            JSON.stringify(
                photoAging
            )
        );

    } catch (error) {

        console.error(
            "Não foi possível salvar o envelhecimento.",
            error
        );

    }

}

/* =========================================
   PROGRESS AGING
========================================= */

function progressPhotoAging(
    id,
    photoData = null
) {

    const state =
        getAgingState(
            id,
            photoData
        );


    /*
        Cada abertura representa uma
        interação física com a fotografia.

        Isso NÃO representa a idade dela.
    */

    state.opens += 1;


    state.level =
        getAgeLevel(
            state.opens
        );


    /*
        Recalcula a idade natural.

        Assim temos:

            idade da foto
                  +
            manuseio
    */

    if (
        photoData &&
        photoData.date
    ) {

        applyNaturalAging(
            state,
            photoData.date
        );

    }


    /* =====================================
       MANUSEIO — MANCHAS
    ===================================== */

    if (
        state.opens >=
        AGE_THRESHOLDS.level1
    ) {

        state.stains =
            clamp(
                state.stains +
                0.009,
                0,
                0.65
            );

    }


    /* =====================================
       MANUSEIO — RISCOS
    ===================================== */

    if (
        state.opens >=
        AGE_THRESHOLDS.level2
    ) {

        state.scratches =
            clamp(
                state.scratches +
                0.006,
                0,
                0.60
            );

    }


    /* =====================================
       DANO PERMANENTE
    ===================================== */

    /*
        O dano permanente depende SOMENTE
        do manuseio.

        A idade da fotografia, por si só,
        não cria esse tipo de dano.
    */

    if (
        state.opens >= 12
    ) {

        state.permanent =
            clamp(
                state.permanent +
                0.008,
                0,
                0.85
            );

    }


    /*
        Depois de 25 aberturas o dano
        permanente acelera.
    */

    if (
        state.opens >= 25
    ) {

        state.permanent =
            clamp(
                state.permanent +
                0.012,
                0,
                0.85
            );

    }


    /*
        Depois de 40 aberturas temos uma
        deterioração ainda mais perceptível.
    */

    if (
        state.opens >= 40
    ) {

        state.permanent =
            clamp(
                state.permanent +
                0.006,
                0,
                0.85
            );

    }

    // Marcas físicas permanentes. Uma vez criadas, nunca são removidas.
    if (state.opens >= 15 && !state.permanentStains.includes(1)) {
        state.permanentStains.push(1);
    }

    if (state.opens >= 25 && !state.permanentStains.includes(2)) {
        state.permanentStains.push(2);
    }

    if (state.opens >= 40 && !state.permanentStains.includes(3)) {
        state.permanentStains.push(3);
    }


    /*
        Salva o estado.
    */

    photoAging[
        String(id)
    ] = state;


    saveAging();


    return state;

}


/* =========================================
   APPLY AGING VARIABLES
========================================= */

function getVisualAgingValues(state) {

    const naturalYellowing =
        state.naturalAge * 0.50;

    const naturalFading =
        state.naturalAge * 0.55;

    const naturalStains =
        state.naturalAge * 0.35;

    return {

        yellowing: clamp(
            naturalYellowing + state.yellowing,
            0,
            0.85
        ),

        fading: clamp(
            naturalFading + state.fading,
            0,
            0.85
        ),

        stains: clamp(
            naturalStains + state.stains,
            0,
            0.85
        ),

        scratches: clamp(
            state.scratches,
            0,
            0.60
        ),

        permanent: clamp(
            state.permanent,
            0,
            0.85
        )

    };

}


function applyAgingVariables(
    element,
    state
) {

    if (!element) return;

    const visual =
        getVisualAgingValues(state);

    element.style.setProperty(
        "--aging-yellowing",
        visual.yellowing.toFixed(3)
    );

    element.style.setProperty(
        "--aging-fading",
        visual.fading.toFixed(3)
    );

    element.style.setProperty(
        "--aging-stains",
        visual.stains.toFixed(3)
    );

    element.style.setProperty(
        "--aging-scratches",
        visual.scratches.toFixed(3)
    );

    element.style.setProperty(
        "--aging-permanent",
        visual.permanent.toFixed(3)
    );

    element.dataset.ageLevel =
        String(state.level);

}


function clearAgeClasses(
    element
) {

    if (!element) return;

    element.classList.remove(
        "age-1",
        "age-2",
        "age-3",
        "age-4",
        "age-5"
    );

}


function syncPermanentAppearance(
    container,
    state
) {

    if (!container) return;

    const permanent = state.permanent;

    container.classList.toggle(
        "permanent-damage",
        permanent >= 0.12
    );

    container.classList.toggle(
        "permanent-wear",
        permanent >= 0.25
    );

    container.classList.toggle(
        "permanent-scratches",
        state.scratches >= 0.20 || permanent >= 0.30
    );

    let damageLayer =
        container.querySelector(
            ".permanent-damage-layer"
        );

    if (!damageLayer) {
        damageLayer =
            document.createElement("div");
        damageLayer.className =
            "permanent-damage-layer";
        container.appendChild(damageLayer);
    }

    damageLayer.style.opacity =
        String(clamp(permanent * 0.72, 0, 0.58));

    const existing =
        container.querySelectorAll(
            ".permanent-stain"
        );

    existing.forEach(
        stain => stain.remove()
    );

    state.permanentStains.forEach(
        stainNumber => {

            const stain =
                document.createElement("span");

            stain.className =
                `permanent-stain stain-${stainNumber}`;

            stain.setAttribute(
                "aria-hidden",
                "true"
            );

            container.appendChild(stain);

        }
    );

}


function applyImageAging(
    image,
    id,
    photoData = null
) {

    if (!image) return;

    const state =
        getAgingState(id, photoData);

    clearAgeClasses(image);

    if (state.level > 0) {
        image.classList.add(
            `age-${state.level}`
        );
    }

    applyAgingVariables(
        image,
        state
    );

    syncPermanentAppearance(
        image.closest(".photo"),
        state
    );

}


function applyViewerAging(
    id,
    photoData = null
) {

    const state =
        getAgingState(id, photoData);

    clearAgeClasses(viewerImage);

    if (state.level > 0) {
        viewerImage.classList.add(
            `age-${state.level}`
        );
    }

    applyAgingVariables(
        viewerImage,
        state
    );

    syncPermanentAppearance(
        viewerImage.closest(".viewer-photo-front"),
        state
    );

    const back =
        viewerPhoto.querySelector(
            ".viewer-photo-back"
        );

    if (back) {

        clearAgeClasses(back);

        if (state.level > 0) {
            back.classList.add(
                `age-${state.level}`
            );
        }

        applyAgingVariables(
            back,
            state
        );

    }

}


/* =========================================
   UPDATE PHOTO POSITIONS
========================================= */

function updatePhotoPositions() {

    const cards =
        photoContainer.querySelectorAll(
            ".photo-card"
        );


    cards.forEach(
        (card, index) => {

            if (
                !card.style.getPropertyValue(
                    "--rotation"
                )
            ) {

                const rotation =
                    (
                        Math.random() * 6 -
                        3
                    ).toFixed(2);


                card.style.setProperty(
                    "--rotation",
                    `${rotation}deg`
                );

            }


            card.style.zIndex =
                String(
                    index + 1
                );

        }
    );

}


/* =========================================
   FORMAT DATE
========================================= */

function formatDate(
    dateValue
) {

    if (!dateValue) {

        return "";

    }


    const parts =
        String(
            dateValue
        ).split("-");


    if (
        parts.length !== 3
    ) {

        return dateValue;

    }


    const year =
        Number(
            parts[0]
        );


    const month =
        Number(
            parts[1]
        );


    const day =
        Number(
            parts[2]
        );


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return dateValue;

    }


    return date.toLocaleDateString(
        "pt-BR",
        {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    );

}


/* =========================================
   DATABASE
========================================= */

function openDataBase() {

    return new Promise(
        (resolve, reject) => {

            if (!window.indexedDB) {

                reject(
                    new Error(
                        "IndexedDB não é suportado neste navegador."
                    )
                );

                return;

            }


            /*
                Reuse existing connection.
            */

            if (db) {

                resolve(db);

                return;

            }


            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );


            request.onupgradeneeded =
                event => {

                    const database =
                        event.target.result;


                    if (
                        !database.objectStoreNames
                            .contains(
                                STORE_NAME
                            )
                    ) {

                        database.createObjectStore(
                            STORE_NAME,
                            {
                                keyPath: "id",
                                autoIncrement: true
                            }
                        );

                    }

                };


            request.onsuccess =
                event => {

                    db =
                        event.target.result;


                    db.onversionchange =
                        () => {

                            db.close();

                            db = null;

                        };


                    resolve(db);

                };


            request.onerror =
                event => {

                    reject(
                        event.target.error
                    );

                };

        }
    );

}


/* =========================================
   SAVE PHOTO TO DATABASE
========================================= */

function savePhoto(
    photoData
) {

    return new Promise(
        (resolve, reject) => {

            if (!db) {

                reject(
                    new Error(
                        "Banco de dados não está aberto."
                    )
                );

                return;

            }


            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            const request =
                store.add(
                    photoData
                );


            request.onsuccess =
                () => {

                    resolve(
                        request.result
                    );

                };


            request.onerror =
                event => {

                    reject(
                        event.target.error
                    );

                };

        }
    );

}


/* =========================================
   UPDATE PHOTO IN DATABASE
========================================= */

function updatePhotoInDatabase(
    photoData
) {

    return new Promise(
        (resolve, reject) => {

            if (!db) {

                reject(
                    new Error(
                        "Banco de dados não está aberto."
                    )
                );

                return;

            }

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.put(photoData);

            request.onsuccess =
                () => resolve();

            request.onerror =
                event => reject(
                    event.target.error
                );

        }
    );

}


/* =========================================
   GET ALL PHOTOS
========================================= */

function getAllPhotos() {

    return new Promise(
        (resolve, reject) => {

            if (!db) {

                reject(
                    new Error(
                        "Banco de dados não está aberto."
                    )
                );

                return;

            }


            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            const request =
                store.getAll();


            request.onsuccess =
                () => {

                    resolve(
                        request.result
                    );

                };


            request.onerror =
                event => {

                    reject(
                        event.target.error
                    );

                };

        }
    );

}

/* =========================================
   DELETE PHOTO FROM DATABASE
========================================= */

function deletePhotoFromDatabase(
    id
) {

    return new Promise(
        (resolve, reject) => {

            if (!db) {

                reject(
                    new Error(
                        "Banco de dados não está aberto."
                    )
                );

                return;

            }


            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            const request =
                store.delete(
                    Number(id)
                );


            request.onsuccess =
                () => {

                    resolve();

                };


            request.onerror =
                event => {

                    reject(
                        event.target.error
                    );

                };

        }
    );

}

/* =========================================
   CREATE ALBUM PHOTO
========================================= */

function displayPhoto(
    photoData
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "photo-card";


    card.dataset.photo =
        String(
            photoData.id
        );


    card.tabIndex =
        0;


    card.setAttribute(
        "role",
        "button"
    );


    card.setAttribute(
        "aria-label",
        "Abrir fotografia"
    );


    /* =====================================
       ROTATION
    ===================================== */

    const rotation =
        (
            Math.random() * 6 -
            3
        ).toFixed(2);


    card.style.setProperty(
        "--rotation",
        `${rotation}deg`
    );


    /* =====================================
       PHOTO
    ===================================== */

    const photo =
        document.createElement(
            "div"
        );


    photo.className =
        "photo";


    const image =
        document.createElement(
            "img"
        );


    const imageURL =
        URL.createObjectURL(
            photoData.image
        );


    image.src =
        imageURL;


    image.alt =
        photoData.memory ||
        "Fotografia de uma memória";


    image.onload =
        () => {

            URL.revokeObjectURL(
                imageURL
            );

        };


    image.onerror =
        () => {

            URL.revokeObjectURL(
                imageURL
            );

        };


    photo.appendChild(
        image
    );

    // O elemento já está no DOM para que as camadas permanentes
    // possam ser criadas no container correto.
    applyImageAging(
        image,
        photoData.id,
        photoData
    );


    /* =====================================
       PHOTO INFORMATION
    ===================================== */

    const info =
        document.createElement(
            "div"
        );


    info.className =
        "photo-info";


    const date =
        document.createElement(
            "span"
        );


    date.textContent =
        formatDate(
            photoData.date
        );


    info.appendChild(
        date
    );


    if (
        photoData.location
    ) {

        const location =
            document.createElement(
                "span"
            );


        location.className =
            "location";


        location.textContent =
            photoData.location;


        info.appendChild(
            location
        );

    }


    card.appendChild(
        photo
    );


    card.appendChild(
        info
    );


    photoContainer.appendChild(
        card
    );


    /* =====================================
       OPEN VIEWER
    ===================================== */

    const open =
        () => {

            openPhotoViewer(
                photoData,
                card
            );

        };


    card.addEventListener(
        "click",
        open
    );


    card.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                open();

            }

        }
    );


    return card;

}


/* =========================================
   LOAD ALBUM
========================================= */

async function loadAlbum() {

    try {

        if (!db) {

            await openDataBase();

        }


        const photos =
            await getAllPhotos();


        /*
            Chronological order.

            Oldest first.
        */

        photos.sort(
            (a, b) => {

                const dateA =
                    new Date(
                        `${a.date}T00:00:00`
                    ).getTime();


                const dateB =
                    new Date(
                        `${b.date}T00:00:00`
                    ).getTime();


                if (
                    dateA !== dateB
                ) {

                    return (
                        dateA -
                        dateB
                    );

                }


                const createdA =
                    Number(
                        a.createdAt || 0
                    );


                const createdB =
                    Number(
                        b.createdAt || 0
                    );


                if (
                    createdA !==
                    createdB
                ) {

                    return (
                        createdA -
                        createdB
                    );

                }


                return (
                    Number(a.id) -
                    Number(b.id)
                );

            }
        );


        photoContainer.innerHTML =
            "";


        photos.forEach(
            photo => {

                displayPhoto(
                    photo
                );

            }
        );


        updatePhotoPositions();


    } catch (error) {

        console.error(
            "Não foi possível carregar o álbum.",
            error
        );

    }

}


/* =========================================
   PICKUP PHOTO
========================================= */

async function pickupPhoto(
    card
) {

    if (!card) {

        return;

    }


    card.classList.remove(
        "returning"
    );


    void card.offsetWidth;


    card.classList.add(
        "pickup"
    );


    await wait(
        650
    );

}


/* =========================================
   RETURN PHOTO
========================================= */

async function returnPhoto(
    card
) {

    if (!card) {

        return;

    }


    card.classList.remove(
        "pickup"
    );


    void card.offsetWidth;


    card.classList.add(
        "returning"
    );


    await wait(
        650
    );


    card.classList.remove(
        "returning"
    );

}


/* =========================================
   SAVE LAST RANDOM PHOTO
========================================= */

function saveLastRandomPhoto(
    id
) {

    lastRandomPhotoId =
        String(id);


    try {

        localStorage.setItem(
            RANDOM_MEMORY_STORAGE_KEY,
            lastRandomPhotoId
        );

    } catch (error) {

        console.warn(
            "Não foi possível salvar a última memória escolhida.",
            error
        );

    }

}


/* =========================================
   CALCULATE MEMORY WEIGHT
========================================= */

/*
    Fotos pouco abertas recebem um peso maior.

    Exemplo aproximado:

        opens = 0  → peso 1.00
        opens = 1  → peso 0.50
        opens = 2  → peso 0.33
        opens = 5  → peso 0.17
        opens = 10 → peso 0.09

    A fotografia não precisa ser a menos
    aberta para ser escolhida.
    Ela apenas recebe uma vantagem.
*/

function getRandomMemoryWeight(
    photo
) {

    const state =
        getAgingState(
            photo.id
        );


    const forgottenWeight =
        1 /
        (
            state.opens + 1
        );


    /*
        Fotografias mais antigas recebem
        uma pequena vantagem adicional.

        A idade da foto não domina a escolha.
    */

    const photoDate =
        new Date(
            `${photo.date}T00:00:00`
        ).getTime();


    const now =
        Date.now();


    const ageInDays =
        Math.max(
            0,
            (
                now -
                photoDate
            ) /
            86400000
        );


    const ageWeight =
        1 +
        Math.min(
            ageInDays / 3650,
            0.35
        );


    return (
        forgottenWeight *
        ageWeight
    );

}


/* =========================================
   CHOOSE RANDOM FORGOTTEN PHOTO
========================================= */

function chooseRandomForgottenPhoto(
    photos
) {

    if (!photos.length) {

        return null;

    }


    /*
        Se existe mais de uma fotografia,
        retiramos a última escolhida.
    */

    let candidates =
        photos.filter(
            photo =>
                String(photo.id) !==
                String(lastRandomPhotoId)
        );


    /*
        Caso exista apenas uma candidata
        depois do filtro, usamos normalmente.
    */

    if (!candidates.length) {

        candidates =
            photos;

    }


    /*
        Cria uma lista ponderada.
    */

    const weightedPhotos =
        candidates.map(
            photo => ({

                photo,

                weight:
                    getRandomMemoryWeight(
                        photo
                    )

            })
        );


    const totalWeight =
        weightedPhotos.reduce(
            (
                total,
                item
            ) =>
                total +
                item.weight,

            0
        );


    /*
        Segurança.
    */

    if (
        totalWeight <= 0
    ) {

        return candidates[
            Math.floor(
                Math.random() *
                candidates.length
            )
        ];

    }


    let random =
        Math.random() *
        totalWeight;


    for (
        const item
        of weightedPhotos
    ) {

        random -=
            item.weight;


        if (
            random <= 0
        ) {

            return item.photo;

        }

    }


    return (
        weightedPhotos[
            weightedPhotos.length - 1
        ].photo
    );

}


/* =========================================
   ALBUM BROWSE ANIMATION
========================================= */

/*
    Faz o álbum "folhear" até a fotografia
    escolhida.

    A animação não altera a ordem das fotos.
*/

async function browseAlbumToPhoto(
    selectedCard
) {

    if (!selectedCard) {

        return;

    }


    const container =
        photoContainer;


    const cards =
        Array.from(
            container.querySelectorAll(
                ".photo-card"
            )
        );


    if (!cards.length) {

        return;

    }


    container.classList.add(
        "album-browsing"
    );


    /*
        Centro da fotografia selecionada.
    */

    const targetCenter =
        selectedCard.offsetLeft +
        (
            selectedCard.offsetWidth / 2
        );


    const containerCenter =
        container.clientWidth / 2;


    const maxScroll =
        Math.max(
            0,
            container.scrollWidth -
            container.clientWidth
        );


    const targetScroll =
        Math.max(
            0,
            Math.min(
                targetCenter -
                containerCenter,

                maxScroll
            )
        );


    const currentScroll =
        container.scrollLeft;


    const distance =
        targetScroll -
        currentScroll;


    /*
        Se a fotografia já estiver perto,
        fazemos uma pequena folheada.
    */

    if (
        Math.abs(distance) < 120
    ) {

        const smallDirection =
            distance >= 0
                ? -1
                : 1;


        const smallMove =
            Math.max(
                0,
                Math.min(
                    currentScroll +
                    (
                        smallDirection *
                        90
                    ),
                    maxScroll
                )
            );


        container.scrollTo(
            {
                left:
                    smallMove,

                behavior:
                    "smooth"
            }
        );


        await wait(
            260
        );

    } else {

        /*
            Primeiro movimento.
        */

        const step1 =
            currentScroll +
            distance * 0.18;


        container.scrollTo(
            {
                left:
                    step1,

                behavior:
                    "smooth"
            }
        );


        await wait(
            220
        );


        /*
            Segundo movimento.
        */

        const step2 =
            currentScroll +
            distance * 0.43;


        container.scrollTo(
            {
                left:
                    step2,

                behavior:
                    "smooth"
            }
        );


        await wait(
            230
        );


        /*
            Terceiro movimento.
        */

        const step3 =
            currentScroll +
            distance * 0.73;


        container.scrollTo(
            {
                left:
                    step3,

                behavior:
                    "smooth"
            }
        );


        await wait(
            280
        );

    }


    /*
        Finalmente chega à memória.
    */

    container.scrollTo(
        {
            left:
                targetScroll,

            behavior:
                "smooth"
        }
    );


    await wait(
        650
    );


    container.classList.remove(
        "album-browsing"
    );


    /*
        Pequeno destaque visual.
    */

    selectedCard.classList.remove(
        "random-focus"
    );


    void selectedCard.offsetWidth;


    selectedCard.classList.add(
        "random-focus"
    );


    setTimeout(
        () => {

            selectedCard.classList.remove(
                "random-focus"
            );

        },
        1250
    );

}


/* =========================================
   SET VIEWER IMAGE
========================================= */

function setViewerImage(
    blob
) {

    /*
        Clean previous object URL.
    */

    if (previousObjectURL) {

        URL.revokeObjectURL(
            previousObjectURL
        );

        previousObjectURL =
            null;

    }


    if (!blob) {

        viewerImage.src =
            "";

        return;

    }


    const objectURL =
        URL.createObjectURL(
            blob
        );


    previousObjectURL =
        objectURL;


    viewerImage.src =
        objectURL;

}


/* =========================================
   WRITE DIRECTLY ON THE BACK OF THE PHOTO
========================================= */

function setupBackNoteEditor() {

    if (!viewerBack || backNoteEditor) {
        return;
    }

    /*
        The old memory text is replaced by the writing area itself.
        This keeps the back visually clean: no label, no save button.
    */
    const textarea =
        document.createElement("textarea");

    textarea.id =
        "backNoteInput";

    textarea.className =
        "back-text back-note-input";

    textarea.maxLength = 180;

    textarea.rows = 5;

    textarea.setAttribute(
        "aria-label",
        "Anotação no verso da fotografia"
    );

    textarea.placeholder =
        "Escreva aqui...";

    if (viewerText) {
        viewerText.replaceWith(textarea);
    } else {
        viewerBack.appendChild(textarea);
    }

    viewerText = textarea;

    backNoteEditor =
        textarea;

    /*
        Clicking inside the writing area must NOT flip the photograph.
        Clicking anywhere else on the back is still allowed to flip it.
    */
    const stopFlip = event => {
        event.stopPropagation();
    };

    textarea.addEventListener(
        "click",
        stopFlip
    );

    textarea.addEventListener(
        "pointerdown",
        stopFlip
    );

    textarea.addEventListener(
        "keydown",
        event => {
            event.stopPropagation();
        }
    );

    /* Save automatically when the user clicks/taps outside the text box. */
    textarea.addEventListener(
        "blur",
        saveBackNote
    );

}

async function saveBackNote() {

    if (
        !backNoteEditor ||
        !currentPhotoData ||
        !currentPhotoId
    ) {
        return;
    }

    const note =
        backNoteEditor.value.trim();

    if (
        (currentPhotoData.backNote || "") ===
        note
    ) {
        return;
    }

    currentPhotoData.backNote =
        note;

    try {

        if (!db) {
            await openDataBase();
        }

        await updatePhotoInDatabase(
            currentPhotoData
        );

    } catch (error) {

        console.error(
            "Não foi possível guardar a anotação no verso.",
            error
        );

    }

}

function prepareBackNote(photoData) {

    setupBackNoteEditor();

    if (!backNoteEditor) {
        return;
    }

    backNoteEditor.value =
        photoData?.backNote || "";

    backNoteEditor.disabled =
        false;

}


/* =========================================
   OPEN PHOTO VIEWER
========================================= */

async function openPhotoViewer(
    photoData,
    card
) {

    if (
        isClosingViewer
    ) {

        return;

    }


    if (
        photoViewer.classList.contains(
            "active"
        )
    ) {

        return;

    }


    currentPhotoId =
        String(
            photoData.id
        );


    currentPhotoData =
        photoData;


    currentPhotoCard =
        card;


    /*
        Every new photograph begins
        on its front.
    */

    viewerFlipped =
        false;


    viewerPhoto.classList.remove(
        "flipped"
    );


    /* =====================================
       PICK UP PHOTO
    ===================================== */

    await pickupPhoto(
        card
    );


    if (
        !currentPhotoData ||
        String(photoData.id) !==
        currentPhotoId
    ) {

        return;

    }


    /* =====================================
       PROGRESS AGING
    ===================================== */

    progressPhotoAging(
    currentPhotoId,
    currentPhotoData
	);


    /* =====================================
       UPDATE GALLERY PHOTO
    ===================================== */

    if (card) {

        const galleryImage =
            card.querySelector(
                "img"
            );


        applyImageAging(
            galleryImage,
            photoData.id,
            photoData
        );

    }


    /* =====================================
       VIEWER IMAGE
    ===================================== */

    setViewerImage(
        photoData.image
    );


    viewerImage.alt =
        photoData.memory ||
        "Fotografia de uma memória";


    /* =====================================
       BACK OF PHOTO
    ===================================== */

    viewerDate.textContent =
        formatDate(
            photoData.date
        );


    viewerText.textContent =
        photoData.memory ||
        "";


    viewerLocation.textContent =
        photoData.location
            ? `— ${photoData.location}`
            : "";


    prepareBackNote(photoData);


    /* =====================================
       APPLY AGING
    ===================================== */

    applyViewerAging(
    photoData.id,
    photoData
	);


    /* =====================================
       OPEN VIEWER
    ===================================== */
	
	/* =====================================
   DELETE PHOTO BUTTON
===================================== */

if (!deletePhotoButton) {

    const viewerDescription =
        photoViewer.querySelector(
            ".viewer-description"
        );

    if (viewerDescription) {

        deletePhotoButton =
            document.createElement(
                "button"
            );

        deletePhotoButton.type =
            "button";

        deletePhotoButton.className =
            "delete-photo-button";

        deletePhotoButton.textContent =
            "Retirar esta fotografia";

        deletePhotoButton.setAttribute(
            "aria-label",
            "Excluir fotografia"
        );

        viewerDescription.appendChild(
            deletePhotoButton
        );

    }

}


deleteArmed = false;

if (deletePhotoButton) {

    deletePhotoButton.classList.remove(
        "armed"
    );

    deletePhotoButton.textContent =
        "retirar esta fotografia";

}

    document.body.classList.add(
        "viewer-open"
    );


    photoViewer.classList.remove(
        "closing"
    );


    photoViewer.classList.add(
        "active"
    );


    photoViewer.setAttribute(
        "aria-hidden",
        "false"
    );


    /* =====================================
       CAMERA FLASH
    ===================================== */

    setTimeout(
        triggerCameraFlash,
        180
    );

}


/* =========================================
   FLIP VIEWER
========================================= */

function flipViewer() {

    if (
        !currentPhotoData ||
        isClosingViewer
    ) {

        return;

    }


    viewerFlipped =
        !viewerFlipped;


    viewerPhoto.classList.toggle(
        "flipped",
        viewerFlipped
    );

}


/* =========================================
   VIEWER CLICK
========================================= */

viewerPhoto.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        flipViewer();

    }
);


/* =========================================
   CLOSE PHOTO VIEWER
========================================= */

async function closePhotoViewer() {

    if (
        !photoViewer.classList.contains(
            "active"
        )
    ) {

        return;

    }


    if (
        isClosingViewer
    ) {

        return;

    }


    isClosingViewer =
        true;


    /* =====================================
       RETURN FRONT
    ===================================== */

    if (
        viewerFlipped
    ) {

        viewerFlipped =
            false;


        viewerPhoto.classList.remove(
            "flipped"
        );


        await wait(
            850
        );

    }


    /* =====================================
       CLOSE VIEWER
    ===================================== */

    photoViewer.classList.add(
        "closing"
    );


    await wait(
        100
    );


    photoViewer.classList.remove(
        "active"
    );


    photoViewer.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "viewer-open"
    );


    await wait(
        450
    );


    /* =====================================
       RETURN PHOTO TO ALBUM
    ===================================== */

    if (
        currentPhotoCard
    ) {

        await returnPhoto(
            currentPhotoCard
        );

    }


    /* =====================================
       CLEAN OBJECT URL
    ===================================== */

    if (
        previousObjectURL
    ) {

        URL.revokeObjectURL(
            previousObjectURL
        );

        previousObjectURL =
            null;

    }


    viewerImage.src =
        "";


    /* =====================================
       CLEAR VIEWER
    ===================================== */

    viewerDate.textContent =
        "";

    viewerText.textContent =
        "";

    viewerLocation.textContent =
        "";


    if (backNoteEditor) {
        backNoteEditor.value = "";
    }


    /* =====================================
       RESET STATE
    ===================================== */

    viewerPhoto.classList.remove(
        "flipped"
    );


    viewerFlipped =
        false;


    currentPhotoId =
        null;


    currentPhotoData =
        null;


    currentPhotoCard =
        null;


    isClosingViewer =
        false;


    photoViewer.classList.remove(
        "closing"
    );


    photoViewer.classList.remove(
        "deleting"
    );


    deleteArmed = false;


    if (deletePhotoButton) {

        deletePhotoButton.classList.remove(
            "armed"
        );

        deletePhotoButton.textContent =
            "Retirar esta fotografia";

    }

}


/* =========================================
   CLOSE VIEWER BUTTON
========================================= */

closeViewerButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        closePhotoViewer();

    }
);


/* =========================================
   CLICK OUTSIDE VIEWER
========================================= */

photoViewer.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            photoViewer
        ) {

            closePhotoViewer();

        }

    }
);


/* =========================================
   ESC KEY
========================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {

            return;

        }


        if (
            photoViewer.classList.contains(
                "active"
            )
        ) {

            closePhotoViewer();

            return;

        }


        if (
            memoryFormOverlay.classList.contains(
                "active"
            )
        ) {

            closeMemoryForm();

        }

    }
);

/* =========================================
   DELETE PHOTO
   RETIRAR DO ÁLBUM
========================================= */

async function deleteCurrentPhoto() {

    if (
        !currentPhotoId ||
        !currentPhotoData ||
        !currentPhotoCard ||
        isClosingViewer
    ) {

        return;

    }


    const id =
        String(
            currentPhotoId
        );

    const card =
        currentPhotoCard;


    /*
        Primeiro clique:
        prepara a retirada.
    */

    if (!deleteArmed) {

        deleteArmed = true;

        if (deletePhotoButton) {

            deletePhotoButton.classList.add(
                "armed"
            );

            deletePhotoButton.textContent =
                "Sim, retirar e rasgar";

        }

        return;

    }


    isClosingViewer = true;


    /*
        A fotografia desliza para baixo,
        como uma fotografia física sendo
        retirada do encaixe do álbum.
    */

    photoViewer.classList.add(
        "deleting"
    );

    card.classList.add(
        "being-removed"
    );


    await wait(
        1050
    );


    try {

        if (!db) {

            await openDataBase();

        }


        await deletePhotoFromDatabase(
            id
        );


        /*
            Remove também o histórico
            de envelhecimento.
        */

        delete photoAging[id];

        saveAging();


        /*
            Se esta era a última memória
            aleatória escolhida, limpa a referência.
        */

        if (
            String(lastRandomPhotoId) === id
        ) {

            lastRandomPhotoId = null;

            try {

                localStorage.removeItem(
                    RANDOM_MEMORY_STORAGE_KEY
                );

            } catch (error) {

                console.warn(
                    "Não foi possível limpar a última memória escolhida.",
                    error
                );

            }

        }


        /*
            Retira a fotografia da galeria.
        */

        card.remove();


        /*
            Limpa o Object URL.
        */

        if (previousObjectURL) {

            URL.revokeObjectURL(
                previousObjectURL
            );

            previousObjectURL =
                null;

        }


        viewerImage.src = "";

        viewerDate.textContent = "";

        viewerText.textContent = "";

        viewerLocation.textContent = "";


        viewerPhoto.classList.remove(
            "flipped"
        );

        viewerFlipped = false;


        currentPhotoId = null;

        currentPhotoData = null;

        currentPhotoCard = null;


        photoViewer.classList.remove(
            "active"
        );

        photoViewer.classList.add(
            "closing"
        );

        photoViewer.classList.remove(
            "deleting"
        );


        document.body.classList.remove(
            "viewer-open"
        );


        if (deletePhotoButton) {

            deletePhotoButton.classList.remove(
                "armed"
            );

            deletePhotoButton.textContent =
                "Retirar esta fotografia";

        }


        deleteArmed = false;

        isClosingViewer = false;


        /*
            Reorganiza as fotografias restantes.
        */

        updatePhotoPositions();


        setTimeout(
            () => {

                photoViewer.classList.remove(
                    "closing"
                );

            },
            450
        );


    } catch (error) {

        console.error(
            "Não foi possível excluir a fotografia.",
            error
        );


        card.classList.remove(
            "being-removed"
        );

        photoViewer.classList.remove(
            "deleting"
        );


        if (deletePhotoButton) {

            deletePhotoButton.classList.remove(
                "armed"
            );

            deletePhotoButton.textContent =
                "Retirar esta fotografia";

        }


        deleteArmed = false;

        isClosingViewer = false;


        alert(
            "Não foi possível retirar esta fotografia."
        );

    }

}

document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".delete-photo-button"
            )
        ) {

            return;

        }

        event.stopPropagation();

        deleteCurrentPhoto();

    }
);

/* =========================================
   RESTORE PHOTO
========================================= */

restorePhotoButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();


        if (
            !currentPhotoId
        ) {

            return;

        }


        const id =
            String(
                currentPhotoId
            );


        const state =
            getAgingState(
                id,
                currentPhotoData
            );


        /*
            Restoration does NOT erase
            permanent physical damage.
        */


        /* =====================================
           REDUCE HANDLING HISTORY
        ===================================== */

        state.opens =
            Math.max(
                0,
                state.opens - 5
            );


        state.level =
            getAgeLevel(
                state.opens
            );


        /* =====================================
           RESTORE REVERSIBLE YELLOWING
        ===================================== */

        state.yellowing =
            clamp(
                state.yellowing * 0.25,
                0,
                0.50
            );


        /* =====================================
           RESTORE FADING
        ===================================== */

        state.fading =
            clamp(
                state.fading * 0.30,
                0,
                0.55
            );


        /* =====================================
           RESTORE STAINS
        ===================================== */

        state.stains =
            clamp(
                state.stains * 0.35,
                0,
                0.65
            );


        /* =====================================
           RESTORE SCRATCHES
        ===================================== */

        state.scratches =
            clamp(
                state.scratches * 0.45,
                0,
                0.60
            );


        /* =====================================
           PERMANENT DAMAGE
        ===================================== */

        // Intencionalmente não alteramos state.permanent.
        // O dano físico permanente não pode ser restaurado.

        applyNaturalAging(
            state,
            currentPhotoData && currentPhotoData.date
        );


        photoAging[id] =
            state;


        saveAging();


        /* =====================================
           UPDATE ALBUM PHOTO
        ===================================== */

        const card =
            document.querySelector(
                `.photo-card[data-photo="${id}"]`
            );


        if (card) {

            const image =
                card.querySelector(
                    "img"
                );


            if (image) {

                applyImageAging(
                    image,
                    id,
                    currentPhotoData
                );

            }

        }


        /* =====================================
           UPDATE VIEWER
        ===================================== */

        applyViewerAging(
            id,
            currentPhotoData
        );


        /* =====================================
           RETURN TO FRONT
        ===================================== */

        if (
            viewerFlipped
        ) {

            viewerFlipped =
                false;


            viewerPhoto.classList.remove(
                "flipped"
            );

        }


        /* =====================================
           RESTORATION ANIMATION
        ===================================== */

        viewerImage.classList.remove(
            "restoring"
        );


        const back =
            viewerPhoto.querySelector(
                ".viewer-photo-back"
            );


        if (back) {

            back.classList.remove(
                "restoring"
            );

        }


        void viewerImage.offsetWidth;


        viewerImage.classList.add(
            "restoring"
        );


        if (back) {

            void back.offsetWidth;

            back.classList.add(
                "restoring"
            );

        }


        setTimeout(
            () => {

                viewerImage.classList.remove(
                    "restoring"
                );


                if (back) {

                    back.classList.remove(
                        "restoring"
                    );

                }

            },
            650
        );

    }
);


/* =========================================
   CAMERA FLASH
========================================= */

function triggerCameraFlash() {

    if (!cameraFlash) {

        return;

    }


    cameraFlash.classList.remove(
        "flash"
    );


    void cameraFlash.offsetWidth;


    cameraFlash.classList.add(
        "flash"
    );

}


/* =========================================
   OPEN MEMORY FORM
========================================= */

addMemoryButton.addEventListener(
    "click",
    () => {

        memoryFormOverlay.classList.add(
            "active"
        );


        memoryFormOverlay.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.classList.add(
            "form-open"
        );

    }
);


/* =========================================
   CLOSE MEMORY FORM
========================================= */

function closeMemoryForm() {

    memoryFormOverlay.classList.remove(
        "active"
    );


    memoryFormOverlay.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "form-open"
    );

}


/* =========================================
   FORM CLOSE BUTTON
========================================= */

closeMemoryFormButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        closeMemoryForm();

    }
);


/* =========================================
   CLICK OUTSIDE FORM
========================================= */

memoryFormOverlay.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            memoryFormOverlay
        ) {

            closeMemoryForm();

        }

    }
);


/* =========================================
   FORM CLICK
========================================= */

memoryForm.addEventListener(
    "click",
    event => {

        event.stopPropagation();

    }
);


/* =========================================
   ADD MEMORY
========================================= */

memoryForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        /* =====================================
           PHOTO
        ===================================== */

        if (
            !photoInput.files ||
            !photoInput.files[0]
        ) {

            alert(
                "Escolha uma fotografia."
            );

            return;

        }


        const file =
            photoInput.files[0];


        /* =====================================
           IMAGE TYPE
        ===================================== */

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "Escolha uma fotografia válida."
            );

            return;

        }


        /* =====================================
           DATE
        ===================================== */

        if (
            !memoryDate.value
        ) {

            alert(
                "Escolha uma data."
            );

            return;

        }


        /* =====================================
           MEMORY
           A memória não é mais preenchida no cadastro da foto.
           Ela pode ser escrita depois diretamente no verso.
        ===================================== */

        try {

            /* =================================
               DATABASE
            ================================= */

            if (!db) {

                await openDataBase();

            }


            /* =================================
               PHOTO DATA
            ================================= */

            const photoData = {

                image:
                    file,

                date:
                    memoryDate.value,

                location:
                    memoryLocation.value.trim(),

                memory:
                    "",

                createdAt:
                    Date.now()

            };


            /* =================================
               SAVE
            ================================= */

            const id =
                await savePhoto(
                    photoData
                );


            photoData.id =
                id;


            /* =================================
               INITIAL AGING
            ================================= */

            photoAging[
                String(id)
            ] =
                createAgingState();


            saveAging();


            /* =================================
               RESET FORM
            ================================= */

            memoryForm.reset();


            /* =================================
               CLOSE
            ================================= */

            closeMemoryForm();


            /* =================================
               RELOAD
            ================================= */

            await loadAlbum();


            /* =================================
               CAMERA FLASH
            ================================= */

            triggerCameraFlash();


            /* =================================
               SCROLL TO NEW PHOTO
            ================================= */

            setTimeout(
                () => {

                    photoContainer.scrollTo(
                        {
                            left:
                                photoContainer.scrollWidth,

                            behavior:
                                "smooth"
                        }
                    );

                },
                100
            );


        } catch (error) {

            console.error(
                "Erro ao salvar lembrança:",
                error
            );


            alert(
                "Não foi possível salvar a lembrança."
            );

        }

    }
);


/* =========================================
   OPEN ALBUM
========================================= */

openAlbum.addEventListener(
    "click",
    async () => {

        /*
            Impede cliques múltiplos enquanto
            a capa está desaparecendo.
        */

        openAlbum.disabled =
            true;


        albumCover.style.opacity =
            "0";


        albumCover.style.transform =
            "scale(1.05)";


        gallery.style.opacity =
            "1";


        setTimeout(
            async () => {

                albumCover.style.display =
                    "none";


                try {

                    /*
                        Garante que temos os dados
                        mais recentes.
                    */

                    const photos =
                        await getAllPhotos();


                    if (!photos.length) {

                        return;

                    }


                    /*
                        Escolhe uma fotografia
                        levando em consideração
                        o quanto ela foi esquecida.
                    */

                    const selectedPhoto =
                        chooseRandomForgottenPhoto(
                            photos
                        );


                    if (!selectedPhoto) {

                        return;

                    }


                    /*
                        Registra a escolha antes
                        da animação.

                        Isso garante que a mesma
                        foto não seja escolhida
                        novamente na próxima abertura.
                    */

                    saveLastRandomPhoto(
                        selectedPhoto.id
                    );


                    /*
                        Encontra o card.
                    */

                    const selectedCard =
                        photoContainer.querySelector(
                            `.photo-card[data-photo="${selectedPhoto.id}"]`
                        );


                    if (!selectedCard) {

                        return;

                    }


                    /*
                        Folheia até a memória.
                    */

                    await browseAlbumToPhoto(
                        selectedCard
                    );


                } catch (error) {

                    console.error(
                        "Não foi possível encontrar uma memória aleatória.",
                        error
                    );

                } finally {

                    openAlbum.disabled =
                        false;

                }

            },
            1000
        );

    }
);



/* =========================================
   ALBUM PACKAGE — EXPORT / IMPORT
========================================= */

const ALBUM_PACKAGE_FORMAT = "polaroid-memory-album";
const ALBUM_PACKAGE_VERSION = 1;
const ALBUM_PACKAGE_EXTENSION = ".album";

function downloadBlob(blob, filename) {

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(index, Math.min(index + chunkSize, bytes.length))
        );
    }

    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes.buffer;
}

async function blobToPackageImage(blob) {

    if (!blob) {
        return null;
    }

    const buffer = await blob.arrayBuffer();

    return {
        type: blob.type || "application/octet-stream",
        size: blob.size,
        data: arrayBufferToBase64(buffer)
    };
}

function packageImageToBlob(image) {

    if (!image || typeof image.data !== "string") {
        throw new Error("Uma fotografia do arquivo está inválida.");
    }

    return new Blob(
        [base64ToArrayBuffer(image.data)],
        { type: image.type || "image/jpeg" }
    );
}

function getSafeAlbumFilename() {

    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");

    return `meu-album-polaroid-${stamp}${ALBUM_PACKAGE_EXTENSION}`;
}

async function createAlbumPackage() {

    const photos = await getAllPhotos();
    const aging = {};

    photos.forEach(photo => {
        const id = String(photo.id);
        aging[id] = getAgingState(id, photo);
    });

    const packagedPhotos = [];

    for (const photo of photos) {

        const image = await blobToPackageImage(photo.image);

        packagedPhotos.push({
            id: photo.id,
            image,
            date: photo.date || "",
            location: photo.location || "",
            memory: photo.memory || "",
            backNote: photo.backNote || "",
            createdAt: photo.createdAt || Date.now()
        });
    }

    return {
        format: ALBUM_PACKAGE_FORMAT,
        version: ALBUM_PACKAGE_VERSION,
        exportedAt: new Date().toISOString(),
        lastRandomPhotoId: lastRandomPhotoId || null,
        photos: packagedPhotos,
        aging
    };
}

async function exportAlbumPackage() {

    if (!db) {
        await openDataBase();
    }

    const packageData = await createAlbumPackage();
    const json = JSON.stringify(packageData);
    const blob = new Blob(
        [json],
        { type: "application/x-polaroid-album" }
    );

    downloadBlob(
        blob,
        getSafeAlbumFilename()
    );

    return packageData.photos.length;
}

function clearPhotoStore() {

    return new Promise((resolve, reject) => {

        if (!db) {
            reject(new Error("Banco de dados não está aberto."));
            return;
        }

        const transaction = db.transaction(STORE_NAME, "readwrite");
        const request = transaction.objectStore(STORE_NAME).clear();

        request.onerror = event => reject(event.target.error);
        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject(event.target.error);
        transaction.onabort = event => reject(event.target.error || new Error("Importação cancelada."));
    });
}

async function hashBlob(blob) {

    if (!blob) {
        return "";
    }

    const buffer = await blob.arrayBuffer();

    if (window.crypto?.subtle) {
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        return Array.from(new Uint8Array(digest))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    /* Fallback simples para navegadores sem SubtleCrypto. */
    const bytes = new Uint8Array(buffer);
    let hash = 2166136261;

    for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 16777619);
    }

    return `fnv-${(hash >>> 0).toString(16)}`;
}

async function getPhotoFingerprint(photo) {

    if (!photo?.image) {
        return "";
    }

    return hashBlob(photo.image);
}

async function getImportedImageFingerprint(image) {

    const blob = packageImageToBlob(image);
    return hashBlob(blob);
}

async function importAlbumPackage(file, mode = "merge") {

    if (!file) {
        throw new Error("Nenhum arquivo de álbum foi selecionado.");
    }

    const raw = await file.text();
    let packageData;

    try {
        packageData = JSON.parse(raw);
    } catch (error) {
        throw new Error("Este arquivo não é um álbum Polaroid válido.");
    }

    if (
        packageData?.format !== ALBUM_PACKAGE_FORMAT ||
        Number(packageData?.version) !== ALBUM_PACKAGE_VERSION ||
        !Array.isArray(packageData?.photos)
    ) {
        throw new Error("O arquivo não pertence a esta versão do álbum.");
    }

    if (!db) {
        await openDataBase();
    }

    const existingPhotos = await getAllPhotos();

    if (mode === "replace") {
        await clearPhotoStore();
    }

    const importedAging = {};
    const importedIds = new Set();
    const skippedDuplicates = new Set();
    const existingFingerprints = new Map();
    const importedIdMap = new Map();

    if (mode === "merge") {
        for (const photo of existingPhotos) {
            const fingerprint = await getPhotoFingerprint(photo);

            if (fingerprint) {
                existingFingerprints.set(fingerprint, String(photo.id));
            }
        }
    }

    for (const item of packageData.photos) {

        if (item?.id === undefined || !item?.image) {
            continue;
        }

        const photoBlob = packageImageToBlob(item.image);
        const fingerprint = await hashBlob(photoBlob);

        /*
            Na mesclagem, a fotografia é identificada pelo conteúdo
            da imagem — e não somente pelo ID do IndexedDB.

            Assim, a mesma foto continua sendo considerada a mesma
            mesmo quando foi exportada de outro computador/álbum.
        */
        if (mode === "merge" && existingFingerprints.has(fingerprint)) {
            const existingId = existingFingerprints.get(fingerprint);
            importedIdMap.set(String(item.id), existingId);
            skippedDuplicates.add(String(item.id));
            continue;
        }

        const photoData = {
            image: photoBlob,
            date: item.date || "",
            location: item.location || "",
            memory: item.memory || "",
            backNote: item.backNote || "",
            createdAt: item.createdAt || Date.now()
        };

        /*
            Nunca confiamos no ID vindo do arquivo durante a mesclagem.
            O IndexedDB cria um novo ID para a fotografia acrescentada.
        */
        if (mode === "replace") {
            photoData.id = item.id;
        }

        let savedId;

        try {
            savedId = await savePhoto(photoData);
        } catch (error) {
            /* Compatibilidade com arquivos antigos/casos de colisão. */
            if (mode === "replace" && error?.name === "ConstraintError") {
                delete photoData.id;
                savedId = await savePhoto(photoData);
            } else {
                throw error;
            }
        }

        const finalId = String(savedId);
        importedIds.add(finalId);
        importedIdMap.set(String(item.id), finalId);
        existingFingerprints.set(fingerprint, finalId);

        const sourceState = packageData.aging?.[String(item.id)];

        if (sourceState) {
            importedAging[finalId] = {
                ...createAgingState(),
                ...sourceState,
                permanentStains: Array.isArray(sourceState.permanentStains)
                    ? sourceState.permanentStains
                    : []
            };
        } else {
            importedAging[finalId] = createAgingState();
        }
    }

    if (mode === "replace") {
        photoAging = importedAging;
    } else {
        photoAging = {
            ...photoAging,
            ...importedAging
        };
    }

    saveAging();

    /*
        Só restauramos a memória aleatória se o ID exportado ainda
        puder ser associado a uma fotografia existente/importada.
    */
    const sourceRandomId = packageData.lastRandomPhotoId;
    const mappedRandomId = sourceRandomId != null
        ? importedIdMap.get(String(sourceRandomId))
        : null;

    if (mode === "replace") {
        lastRandomPhotoId = mappedRandomId || null;
    } else if (mappedRandomId) {
        lastRandomPhotoId = Number.isNaN(Number(mappedRandomId))
            ? mappedRandomId
            : Number(mappedRandomId);
    }

    try {
        if (lastRandomPhotoId != null) {
            localStorage.setItem(
                RANDOM_MEMORY_STORAGE_KEY,
                String(lastRandomPhotoId)
            );
        } else if (mode === "replace") {
            localStorage.removeItem(RANDOM_MEMORY_STORAGE_KEY);
        }
    } catch (error) {
        console.warn("Não foi possível restaurar a memória aleatória.", error);
    }

    await loadAlbum();

    return {
        imported: importedIds.size,
        skipped: skippedDuplicates.size,
        total: packageData.photos.length
    };
}

function createAlbumSharingUI() {

    if (!gallery || document.getElementById("albumShareButton")) {
        return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.id = "albumShareButton";
    button.className = "album-share-button";
    button.setAttribute("aria-label", "Compartilhar álbum");
    button.innerHTML = `
        <span class="album-share-icon" aria-hidden="true">✦</span>
        <span class="album-share-label">Meu álbum</span>
    `;

    const panel = document.createElement("div");
    panel.id = "albumSharePanel";
    panel.className = "album-share-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
        <div class="album-share-card" role="dialog" aria-modal="false" aria-labelledby="albumShareTitle">
            <button type="button" class="album-share-close" aria-label="Fechar">×</button>
            <div class="album-share-stamp" aria-hidden="true">✉</div>
            <p class="album-share-eyebrow">UM PEDACINHO DE VOCÊ</p>
            <h2 id="albumShareTitle">Leve o álbum com você</h2>
            <p class="album-share-copy">
                Exporte fotos, histórias, anotações e até o envelhecimento físico das fotografias em um único arquivo.
            </p>
            <div class="album-share-actions">
                <button type="button" id="exportAlbumButton" class="album-action primary">
                    <span>✦</span>
                    <span><strong>Guardar uma cópia</strong><small>Cria um arquivo .album para enviar</small></span>
                </button>
                <button type="button" id="mergeAlbumButton" class="album-action merge-action">
                    <span>⊕</span>
                    <span><strong>Mesclar um álbum</strong><small>Acrescenta só as fotografias que faltam</small></span>
                </button>
                <button type="button" id="replaceAlbumButton" class="album-action">
                    <span>↥</span>
                    <span><strong>Substituir pelo álbum</strong><small>Troca o álbum atual pela cópia recebida</small></span>
                </button>
            </div>
            <p class="album-share-footnote">O arquivo contém suas fotografias e dados do álbum. Guarde-o como uma lembrança.</p>
            <input id="albumImportInput" type="file" accept=".album,application/json,application/x-polaroid-album" hidden>
        </div>
    `;

    document.body.appendChild(button);
    document.body.appendChild(panel);

    const closePanel = () => {
        panel.classList.remove("active");
        panel.setAttribute("aria-hidden", "true");
        button.classList.remove("active");
    };

    const openPanel = () => {
        panel.classList.add("active");
        panel.setAttribute("aria-hidden", "false");
        button.classList.add("active");
    };

    button.addEventListener("click", event => {
        event.stopPropagation();
        if (panel.classList.contains("active")) closePanel();
        else openPanel();
    });

    panel.querySelector(".album-share-close").addEventListener("click", closePanel);

    panel.addEventListener("click", event => {
        if (event.target === panel) closePanel();
    });

    const exportButton = panel.querySelector("#exportAlbumButton");
    const mergeButton = panel.querySelector("#mergeAlbumButton");
    const replaceButton = panel.querySelector("#replaceAlbumButton");
    const importInput = panel.querySelector("#albumImportInput");
    let pendingImportMode = "merge";

    exportButton.addEventListener("click", async () => {

        const original = exportButton.innerHTML;
        exportButton.disabled = true;
        exportButton.classList.add("loading");
        exportButton.innerHTML = `
            <span class="album-spinner">◌</span>
            <span><strong>Preparando suas lembranças…</strong><small>Reunindo fotografias e histórias</small></span>
        `;

        try {
            const count = await exportAlbumPackage();
            exportButton.innerHTML = `
                <span>✓</span>
                <span><strong>Cópia pronta</strong><small>${count} fotografia${count === 1 ? "" : "s"} guardada${count === 1 ? "" : "s"} no arquivo</small></span>
            `;
            setTimeout(() => {
                exportButton.innerHTML = original;
                exportButton.disabled = false;
                exportButton.classList.remove("loading");
            }, 2400);
        } catch (error) {
            console.error("Erro ao exportar álbum:", error);
            alert("Não foi possível criar a cópia do álbum.");
            exportButton.innerHTML = original;
            exportButton.disabled = false;
            exportButton.classList.remove("loading");
        }
    });

    function chooseAlbumImport(mode) {
        pendingImportMode = mode;
        importInput.value = "";
        importInput.click();
    }

    mergeButton.addEventListener("click", () => chooseAlbumImport("merge"));
    replaceButton.addEventListener("click", () => chooseAlbumImport("replace"));

    importInput.addEventListener("change", async () => {

        const file = importInput.files?.[0];

        if (!file) {
            return;
        }

        const mode = pendingImportMode;
        const message = mode === "merge"
            ? "Quer mesclar este álbum ao seu álbum atual?\n\nAs fotografias que já existem serão reconhecidas e ignoradas. Somente as que faltam serão acrescentadas.\n\nSeu álbum atual não será apagado."
            : "Quer substituir o álbum atual pela cópia recebida?\n\nEsta opção apaga as fotografias atuais e restaura a cópia.\n\nUse 'Mesclar um álbum' se quiser manter o que já está aqui.";

        if (!confirm(message)) {
            return;
        }

        const actionButton = mode === "merge" ? mergeButton : replaceButton;
        const original = actionButton.innerHTML;

        exportButton.disabled = true;
        mergeButton.disabled = true;
        replaceButton.disabled = true;
        actionButton.classList.add("loading");
        actionButton.innerHTML = `
            <span class="album-spinner">◌</span>
            <span><strong>${mode === "merge" ? "Costurando as lembranças…" : "Revelando o álbum…"}</strong><small>${mode === "merge" ? "Comparando fotografias e acrescentando as que faltam" : "Restaurando fotografias e histórias"}</small></span>
        `;

        try {
            const result = await importAlbumPackage(file, mode);

            if (mode === "merge") {
                actionButton.innerHTML = `
                    <span>⊕</span>
                    <span><strong>Álbuns mesclados</strong><small>${result.imported} nova${result.imported === 1 ? "" : "s"} fotografia${result.imported === 1 ? "" : "s"} acrescentada${result.imported === 1 ? "" : "s"}${result.skipped ? ` · ${result.skipped} já estava${result.skipped === 1 ? "" : "m"} no álbum` : ""}</small></span>
                `;
            } else {
                actionButton.innerHTML = `
                    <span>✓</span>
                    <span><strong>Álbum restaurado</strong><small>${result.imported} fotografia${result.imported === 1 ? "" : "s"} voltou${result.imported === 1 ? "" : "ram"} para o álbum</small></span>
                `;
            }

            setTimeout(() => {
                closePanel();
                actionButton.innerHTML = original;
                exportButton.disabled = false;
                mergeButton.disabled = false;
                replaceButton.disabled = false;
                actionButton.classList.remove("loading");
            }, 2200);

        } catch (error) {
            console.error("Erro ao importar álbum:", error);
            alert(error.message || "Não foi possível importar o álbum.");
            actionButton.innerHTML = original;
            exportButton.disabled = false;
            mergeButton.disabled = false;
            replaceButton.disabled = false;
            actionButton.classList.remove("loading");
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && panel.classList.contains("active")) {
            closePanel();
        }
    });
}

/* =========================================
   INITIALIZE
========================================= */

async function initializeAlbum() {

    createAlbumSharingUI();

    try {

        await openDataBase();

        await loadAlbum();

    } catch (error) {

        console.error(
            "Não foi possível inicializar o álbum.",
            error
        );

    }

}


initializeAlbum();