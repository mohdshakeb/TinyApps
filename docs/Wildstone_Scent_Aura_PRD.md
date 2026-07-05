# Product Requirement Document (PRD)

## Project Name: Wildstone "The Scent Aura" Web AR Experience
**Version:** 1.0  
**Target Architecture:** Mobile-First Web App (Responsive Web)  
**Primary Goal:** Experiential Marketing, Brand Engagement, Viral Social Sharing  

---

## 1. Executive Summary
"The Scent Aura" is an interactive, mobile-first Web AR marketing experience designed for Wildstone. The application leverages real-time front-facing camera input and lightweight computer vision (face/silhouette tracking) to envelope the user in a dynamic, responsive digital "scent aura" that matches the personality of Wildstone deodorant variants. 

The primary metric of success is user engagement and the creation of a shareable digital artifact (a looping video/GIF or stylized snapshot) that users can organically push to platforms like Instagram Stories, WhatsApp Status, and TikTok.

---

## 2. Core User Experience & Flow
1. **Entry:** User scans a QR code on product packaging or clicks a digital ad link.
2. **Onboarding:** A sleek, premium dark-themed splash screen opens. It requests camera permissions with clear, brand-aligned onboarding copy (*"Allow camera access to unlock your aura"*).
3. **The Experience Loop:** - The front-facing camera initializes.
   - A tracking engine isolates the user's face/shoulders.
   - An interactive WebGL/Canvas layer overlays a kinetic, fluid aura that moves and ripples dynamically based on user head movement.
   - A carousel at the bottom allows users to switch between three Wildstone variant themes (Red, Edge, Intense Black), instantly changing the visual physics and color scheme.
4. **The Capture (Artifact Creation):** User presses a circular "Capture" button. The app records a 5-second looping video sequence or takes a high-fidelity snapshot with a branded Wildstone overlay.
5. **Sharing:** A native Web Share sheet or instant download link allows the user to post the asset directly to social media.

---

## 3. Product Features & Scope

### 3.1 Front-End UI Components
* **Camera Viewport:** A full-bleed, mobile-optimized view displaying the user's live video stream.
* **The Scent Carousel:** A swipeable horizontal layout or minimalist tab group at the bottom of the screen featuring the Wildstone variants:
    * **Wildstone Red:** Fierce, rapid crimson/amber energy bursts.
    * **Wildstone Edge:** Sharp, high-frequency electric blue lightning/energy arcs.
    * **Wildstone Intense Black:** Deep, slow-moving monochrome smoky nebula.
* **Interaction Controls:**
    * *Capture Button:* Single tap for image snapshot, long-press or tap-to-record for a 5-second video asset.
    * *Retry/Reset:* Allows resetting the scene or clearing the canvas to start over.
* **Branded Overlay:** A clean, high-fashion translucent watermark positioned dynamically at the top right or bottom left corners (e.g., `#IntensifyYourGame | Wildstone [Variant Name]`).

### 3.2 The Tracking & Visuals Engine (AR Layer)
* **Lightweight Face/Pose Tracking:** Tracks orientation and coordinates of the head and shoulders. For high-performance implementation across standard browsers, a lightweight alternative using modern Canvas2D/WebGL mathematically driven by cursor/touch or simplified face anchors is acceptable.
* **Aura Particle System:** Generates fluid-like or electric elements emitting outwards behind or around the coordinate center.
* **Motion Inertia:** The particles must have velocity and drag so that when the user moves, the aura trails elegantly and creates trailing wisps before dissolving.

---

## 4. Technical Specifications & Stack
To ensure this runs perfectly without app store friction, the execution should rely purely on browser native technologies.

* **UI Framework:** Vanilla HTML5/CSS3 (or Tailwind CSS) structured dynamically via JavaScript.
* **Graphics & Shader Engine:** HTML5 Canvas API or a lightweight Three.js context utilizing optimized WebGL fragment/vertex shaders for fluid mechanics.
* **Performance Targets:** * Target 60 FPS on iOS (Safari) and Android (Chrome) devices.
    * Initial page load weight under 3MB to prevent bounce rates in mobile data environments.
* **Camera Integration:** Secure `getUserMedia()` stream configured with explicit mobile tags:
    ```html
    <video id="webcam" autoplay playsinline muted></video>
    ```
* **Asset Export:** * For images: `canvas.toDataURL('image/jpeg')`.
    * For video looping: Implementation of the native `MediaRecorder` API gathering stream tracks from the canvas compound layer.

---

## 5. Non-Functional Requirements & Performance Gotchas
* **No Flex/Grid Body Constraints:** For reliable fixed A4/Mobile bounds inside cross-platform rendering setups, avoid complex flexible layout wrappers on the global element level; stick to strict positional canvas bounds.
* **Device Temperature & Battery:** Shaders must minimize texture lookups and multi-pass rendering loops. Use mathematical noise functions (such as Perlin or Simplex algorithms) directly inside the vertex layer to achieve organic motion without processing heavy asset grids.
* **Fallback Experience:** If camera permissions are denied or unavailable, the application should gracefully transition into an interactive "Touch Canvas" mode where users generate the Wildstone aura via finger drags across a premium gradient silhouette card.
