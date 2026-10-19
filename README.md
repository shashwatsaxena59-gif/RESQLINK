# 🚨 ResQLink

### AI-Powered Disaster Response & Rescue Assistance Platform

ResQLink is a disaster-response web application designed to help people **find assistance, report emergencies, locate nearby shelters, and coordinate rescue efforts** during natural disasters.

The platform brings essential emergency-response information into one place through an intuitive and responsive interface.

---

## 🌐 Live Demo

🚀 **[Try ResQLink Live](https://resqlink-final.onrender.com/)**

> **Note:** The live demo is hosted on Render. The application may take a short time to load if the server is waking up.

---

## 🌪️ Problem Statement

During natural disasters such as floods, earthquakes, cyclones, and other emergencies, people often struggle to:

* 🚨 Quickly communicate that they need help
* 📍 Find nearby shelters and safe locations
* 🏥 Locate emergency assistance
* 🤝 Connect people who need help with people willing to help
* 📡 Access disaster-related updates
* 🗺️ Understand their location and nearby emergency resources

ResQLink aims to provide a centralized platform for faster and more organized disaster response.

---

## 💡 Our Solution

ResQLink provides a unified emergency-response platform where users can:

* 🆘 Send an SOS alert
* 🗺️ View their location on an interactive map
* 🔎 Find nearby help
* 🏠 Discover shelters
* 🙋 Offer assistance to affected people
* 📡 View live disaster-related updates
* 🧭 Use compass-based navigation support

---

## ✨ Key Features

### 🆘 SOS Emergency Alert

Users can trigger an SOS alert during an emergency to indicate that they need immediate assistance.

 ### 🤖 AI-based emergency triage

 Users can type or say about their situation ina any language ,hinglish too and it will take each detail from even one line.

### 🗺️ Interactive Map

The map interface helps users visualize their location and identify relevant emergency resources.

### 🏠 Shelter Finder

Users can view available shelters and identify safer locations during a disaster.

### 🔎 Find Help

People requiring assistance can use the **Find Help** functionality to communicate their emergency needs.

### 🙋 Offer Help

Volunteers or nearby users can offer assistance to people affected by a disaster.

### 📡 Live Feed

The live-feed section provides updates related to ongoing emergency situations.

### 🧭 Compass & Navigation

Compass functionality helps users with orientation and navigation during emergency situations.

### 📱 Responsive Design

The application is designed to provide a smooth experience across:

* 💻 Desktop
* 📱 Mobile
* 📟 Tablet

---

## 🖥️ Application Overview

```text
                     🚨 ResQLink
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
       🆘                🗺️                📡
      SOS               Map             Live Feed
        │                 │                 │
        ├──────────────┬──┴──────────────┐  │
        │              │                 │  │
       🏠             🔎                🙋 🧭
    Shelters       Find Help        Offer Help
                                      Compass
```

---

## 🛠️ Tech Stack

### Frontend

* ⚛️ React
* 📘 TypeScript
* ⚡ Vite
* 🎨 CSS
* 🧩 React Components

### Development Tools

* Git
* GitHub
* VS Code
* Vite Development Server

### Deployment

* Render

---

## 📂 Project Structure

```text
ResQLink/
│
├── src/
│   ├── components/
│   │   ├── compass-hud.tsx
│   │   ├── find-help-panel.tsx
│   │   ├── live-feed.tsx
│   │   ├── map-view.tsx
│   │   ├── mobile-nav.tsx
│   │   ├── offer-help-panel.tsx
│   │   ├── shelter-widget.tsx
│   │   ├── sos-drawer.tsx
│   │   ├── status-banner.tsx
│   │   ├── top-nav.tsx
│   │   │
│   │   └── ui/
│   │       ├── dialog.tsx
│   │       └── sheet.tsx
│   │
│   ├── hooks/
│   │   └── use-compass.ts
│   │
│   ├── lib/
│   │   └── utils.ts
│   │
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/bhumikaa0006-create/ResQLinkk.git
```

### 2. Navigate to the Project

```bash
cd ResQLinkk
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

---

## 🔧 Environment Variables

If external APIs or services are used, create a `.env` file in the project root:

```env
VITE_API_KEY=your_api_key
```

Only add environment variables that are actually required by your implementation.

> ⚠️ Never commit your `.env` file or expose private API keys in the repository.

---

## 🌍 Use Cases

ResQLink can support emergency-response scenarios involving:

* 🌊 Floods
* 🌎 Earthquakes
* 🌪️ Cyclones
* 🌧️ Severe weather events
* 🚨 Community-level emergencies
* 🏘️ Local disaster situations

---

## 🎯 Future Improvements

Future versions of ResQLink could include:

* 🧠 NLP-based emergency message classification
* 📲 Push notifications
* 🛰️ Real-time disaster-data integration
* 🏥 Live hospital and ambulance availability
* 👥 Verified volunteer network
* 🔐 User authentication and role-based access
* 📊 Disaster analytics dashboard


---

## 🔐 Safety & Privacy

ResQLink is intended as a **disaster-response assistance platform**.

For real emergencies, users should also contact official emergency services and follow instructions from local authorities.

The application should handle emergency, location, and user information responsibly and avoid exposing unnecessary personal information.

---

## 🤝 Contributing

Contributions are welcome!

```bash
# Fork the repository

# Create a new branch
git checkout -b feature/your-feature

# Make your changes

# Stage changes
git add .

# Commit changes
git commit -m "Add new feature"

# Push your branch
git push origin feature/your-feature
```

Then open a Pull Request.

---

## 📌 Project Status

🚧 **Active Development**

ResQLink is continuously being improved with new disaster-response and emergency-assistance features.

---

## 👩‍💻 Author

**Bhumika**

A disaster-response technology project focused on making emergency assistance more accessible, organized, and responsive.

---

## ⭐ Support

If you find ResQLink useful, consider giving the repository a ⭐ on GitHub!

### 🚨 ResQLink

**Connecting people to help when it matters most.**
