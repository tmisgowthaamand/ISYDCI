const fs = require('fs');
const crypto = require('crypto');

function makeId() {
  return crypto.randomUUID();
}

function buildFlow() {
  // Node IDs
  const rootId = "root";
  const unifiedRegCardId = makeId();
  const regFormId = makeId();
  const regCompleteId = makeId();
  const exploreMenuId = makeId();
  const tournInfoId = makeId();
  const eventsId = makeId();
  const rosterId = makeId();
  const sportsDirId = makeId();
  const sportOverviewId = makeId();
  const statesDirId = makeId();
  const stateDetailId = makeId();
  const secretariatId = makeId();

  // Root Node Buttons
  const rootBtnReg = makeId();
  const rootBtnCard = makeId();
  const rootBtnExplore = makeId();

  const rootNode = {
    nodeId: rootId,
    type: "interactive",
    name: "ISYDCI Welcome & Menu",
    interactiveId: null,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 100, y: 100 },
    keywords: ["hi", "hello", "hey", "isydci", "start", "menu"],
    data: {
      interactiveType: "button",
      body: "🏆 *Welcome to Indian Sports Youth Development Council of India (ISYDCI)*!\n\nEmpowering Indian athletes through national championships, talent pathways, official membership & athlete accreditation.\n\n📍 Reg No: 49/1997 | New Delhi HQ\n\nHow can we assist you today?",
      header: { type: "text", text: "ISYDCI Official" },
      footer: "Official WhatsApp Portal",
      action: {
        buttons: [
          { type: "reply", reply: { id: rootBtnReg, title: "Register" } },
          { type: "reply", reply: { id: rootBtnCard, title: "Membership Card" } },
          { type: "reply", reply: { id: rootBtnExplore, title: "Explore ISYDCI" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 1. UNIFIED REGISTRATION & MEMBERSHIP CARD NODE
  const regBtnComplete = makeId();
  const regBtnVerify = makeId();
  const regBtnMenu = makeId();

  const unifiedRegCardNode = {
    nodeId: unifiedRegCardId,
    type: "interactive",
    name: "Athlete Registration & ID Card",
    interactiveId: rootBtnReg,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 400, y: -100 },
    keywords: ["Register", "Membership Card", "Register & Card"],
    data: {
      interactiveType: "button",
      body: "🪪 *ISYDCI Athlete Registration & Membership Card*\n\nRegistration directly generates your official national athlete accreditation and verified digital ID card:\n\n1️⃣ Instant Digital Athlete Membership Card\n2️⃣ National Championship & Trials Eligibility\n3️⃣ Official Council Accreditation (Reg No: 49/1997)\n\nTo register and receive your card, choose an option below:",
      header: { type: "text", text: "Registration & Card" },
      footer: "ISYDCI National Registry",
      action: {
        buttons: [
          { type: "reply", reply: { id: regBtnComplete, title: "Complete Registration" } },
          { type: "reply", reply: { id: regBtnVerify, title: "Verify Membership" } },
          { type: "reply", reply: { id: regBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 2. REGISTRATION FORM STEP
  const formBtnIssue = makeId();
  const formBtnSport = makeId();
  const formBtnMenu = makeId();

  const regFormNode = {
    nodeId: regFormId,
    type: "interactive",
    name: "Athlete Registration Details",
    interactiveId: regBtnComplete,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 750, y: -100 },
    keywords: ["Complete Registration"],
    data: {
      interactiveType: "button",
      body: "📝 *Athlete Registration Details*\n\nOfficial accreditation profile:\n• Council: Indian Sports Youth Development Council\n• Registration Act: 49/1997 (New Delhi HQ)\n• Category: Senior & Youth National Pathway\n• Verification: Instant Digital ID Card Issue\n\nTap *Confirm & Issue Card* to complete registration and generate your digital athlete card:",
      header: { type: "text", text: "Athlete Profile" },
      footer: "isydci.vercel.app/membership-card",
      action: {
        buttons: [
          { type: "reply", reply: { id: formBtnIssue, title: "Confirm & Issue Card" } },
          { type: "reply", reply: { id: formBtnSport, title: "Select Sport" } },
          { type: "reply", reply: { id: formBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 3. REGISTRATION COMPLETE & ID CARD DELIVERY
  const completeBtnDl = makeId();
  const completeBtnTourn = makeId();
  const completeBtnMenu = makeId();

  const regCompleteNode = {
    nodeId: regCompleteId,
    type: "interactive",
    name: "Registration Complete & ID Card",
    interactiveId: formBtnIssue,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 1100, y: -100 },
    keywords: ["Confirm & Issue Card", "Issue ID Card"],
    data: {
      interactiveType: "button",
      body: "🎉 *Registration Complete & ID Card Issued!*\n\nCongratulations! Your athlete registration is officially confirmed in the national registry.\n\n👤 Athlete: Amit Kumar\n🆔 Member ID: ISYDCI-684DDC04\n🥊 Status: Verified Athlete ✅\n📅 Validity: 2026 – 2027\n\nTap *Download ID Card* to receive your official digital membership card PNG:",
      header: { type: "text", text: "Accreditation Confirmed" },
      footer: "Official Council Card",
      action: {
        buttons: [
          { type: "reply", reply: { id: completeBtnDl, title: "Download ID Card" } },
          { type: "reply", reply: { id: completeBtnTourn, title: "Tournament Info" } },
          { type: "reply", reply: { id: completeBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 4. Explore Services Menu
  const exploreRows = [
    { id: makeId(), title: "Tournament Info", description: "National championship, fee & draw info" },
    { id: makeId(), title: "Upcoming Events", description: "State trials, national meets & calendar" },
    { id: makeId(), title: "Athletes Roster", description: "National athletes, medalists & profiles" },
    { id: makeId(), title: "Select Sport", description: "Browse officially recognized sports" },
    { id: makeId(), title: "Select State", description: "State & district association branches" },
    { id: makeId(), title: "ISYDCI Secretariat", description: "New Delhi headquarters & official desk" },
    { id: makeId(), title: "Main Menu", description: "Return to main welcome greeting" }
  ];

  const exploreNode = {
    nodeId: exploreMenuId,
    type: "interactive",
    name: "ISYDCI Services Menu",
    interactiveId: rootBtnExplore,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 400, y: 300 },
    keywords: ["Explore ISYDCI"],
    data: {
      interactiveType: "list",
      body: "🏅 *ISYDCI Official Services & Information*\n\nPlease select any department or service below to proceed:",
      header: { type: "none", text: "" },
      footer: "Select an option from list",
      action: {
        button: "View Services",
        sections: [
          { title: "Championships & Events", rows: exploreRows.slice(0, 2) },
          { title: "Athletes & Services", rows: exploreRows.slice(2) }
        ],
        dynamicRows: { enabled: false }
      }
    }
  };

  // 5. Tournament Info
  const tournBtnUtr = makeId();
  const tournBtnDraw = makeId();
  const tournBtnMenu = makeId();

  const tournInfoNode = {
    nodeId: tournInfoId,
    type: "interactive",
    name: "National Championship Info",
    interactiveId: exploreRows[0].id,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 750, y: 150 },
    keywords: ["Tournament Info"],
    data: {
      interactiveType: "button",
      body: "🏆 *ISYDCI National Championship*\n\n• Entry Fee: ₹2,000 per athlete\n• Official Payment: UPI / QR Code\n• Draw Number: Issued upon UTR confirmation\n\nSteps to finalize your entry:\n1. Pay entry fee via UPI QR\n2. Note your 12-digit UTR reference\n3. Tap 'Submit UTR' or send screenshot\n4. Tap 'Check Draw Number' for your draw status",
      header: { type: "text", text: "National Tournament" },
      footer: "₹2,000 Entry Fee",
      action: {
        buttons: [
          { type: "reply", reply: { id: tournBtnUtr, title: "Submit UTR" } },
          { type: "reply", reply: { id: tournBtnDraw, title: "Check Draw Number" } },
          { type: "reply", reply: { id: tournBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 6. Upcoming Events
  const eventsBtnRoster = makeId();
  const eventsBtnTourn = makeId();
  const eventsBtnMenu = makeId();

  const eventsNode = {
    nodeId: eventsId,
    type: "interactive",
    name: "Upcoming Events & Trials",
    interactiveId: exploreRows[1].id,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 750, y: 350 },
    keywords: ["Upcoming Events"],
    data: {
      interactiveType: "button",
      body: "📅 *Upcoming Events & National Calendar*\n\n1. National Youth Athletics Meet — Delhi\n2. State Selection Trials — Tamil Nadu, Karnataka & Maharashtra\n3. National Inter-Club Badminton Championship\n4. Youth Boxing Talent Camp\n\nFor fixture updates and draw notifications, keep your membership active.",
      header: { type: "text", text: "National Calendar" },
      footer: "2026-2027 Season",
      action: {
        buttons: [
          { type: "reply", reply: { id: eventsBtnRoster, title: "Athletes Roster" } },
          { type: "reply", reply: { id: eventsBtnTourn, title: "Tournament Info" } },
          { type: "reply", reply: { id: eventsBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 7. Athletes Roster
  const rosterBtnReg = makeId();
  const rosterBtnSport = makeId();
  const rosterBtnMenu = makeId();

  const rosterNode = {
    nodeId: rosterId,
    type: "interactive",
    name: "Featured Athletes Roster",
    interactiveId: exploreRows[2].id,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 750, y: 550 },
    keywords: ["Athletes Roster"],
    data: {
      interactiveType: "button",
      body: "🌟 *ISYDCI National Athletes Roster*\n\nOur council represents 10,000+ accredited athletes competing across 28 states and union territories in premier Olympic & Commonwealth sporting events.\n\nEvery certified athlete receives a unique Member ID and scannable QR card.",
      header: { type: "text", text: "Athletes Roster" },
      footer: "ISYDCI Champions",
      action: {
        buttons: [
          { type: "reply", reply: { id: rosterBtnReg, title: "Register" } },
          { type: "reply", reply: { id: rosterBtnSport, title: "Select Sport" } },
          { type: "reply", reply: { id: rosterBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 8. Sports Directory
  const sportsRows = [
    { id: makeId(), title: "Athletics & Track", description: "Sprint, hurdles, marathon, jumps & throws" },
    { id: makeId(), title: "Boxing & Combat", description: "Amateur boxing, ring bouts & youth gloves" },
    { id: makeId(), title: "Wrestling & Kushti", description: "Freestyle, Greco-Roman & traditional" },
    { id: makeId(), title: "Badminton & Racquet", description: "Singles, doubles & junior national league" },
    { id: makeId(), title: "Kabaddi & Kho-Kho", description: "National mat tournaments & pro trials" },
    { id: makeId(), title: "Football & Futsal", description: "Grassroots academies & state teams" },
    { id: makeId(), title: "Archery & Shooting", description: "Recurve, compound & 10m air rifle" },
    { id: makeId(), title: "Weightlifting", description: "Snatch, clean & jerk national categories" },
    { id: makeId(), title: "Swimming & Aquatics", description: "Freestyle, backstroke & relay meets" },
    { id: makeId(), title: "Martial Arts", description: "Taekwondo, Karate, Wushu & Judo" }
  ];

  const sportsDirNode = {
    nodeId: sportsDirId,
    type: "interactive",
    name: "Sports Directory",
    interactiveId: exploreRows[3].id,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 750, y: 750 },
    keywords: ["Select Sport"],
    data: {
      interactiveType: "list",
      body: "🏅 *Recognized Sports Disciplines*\n\nISYDCI sanctions trials, national meets and state tournaments across Olympic disciplines. Select your discipline below:",
      header: { type: "none", text: "" },
      footer: "Choose discipline",
      action: {
        button: "Choose Sport",
        sections: [
          { title: "Olympic Sports", rows: sportsRows.slice(0, 5) },
          { title: "National Sports", rows: sportsRows.slice(5) }
        ],
        dynamicRows: { enabled: false }
      }
    }
  };

  // 9. Sport Category Overview
  const sportBtnReg = makeId();
  const sportBtnState = makeId();
  const sportBtnMenu = makeId();

  const sportOverviewNode = {
    nodeId: sportOverviewId,
    type: "interactive",
    name: "Sport Category Overview",
    interactiveId: sportsRows[0].id,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 1100, y: 750 },
    keywords: ["Athletics & Track"],
    data: {
      interactiveType: "button",
      body: "🏃 *Discipline Overview & Eligibility*\n\nAthletes registered in this category are entered into the ISYDCI National Talent Pool. You will receive notifications for trials and championship registration.\n\nTo enroll as an official athlete in this sport:",
      header: { type: "text", text: "Discipline Portal" },
      footer: "ISYDCI Accredited",
      action: {
        buttons: [
          { type: "reply", reply: { id: sportBtnReg, title: "Register" } },
          { type: "reply", reply: { id: sportBtnState, title: "Select State" } },
          { type: "reply", reply: { id: sportBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 10. State Associations
  const stateRows = [
    { id: makeId(), title: "Tamil Nadu State", description: "Chennai, Madurai, Coimbatore & districts" },
    { id: makeId(), title: "Karnataka State", description: "Bengaluru, Mysuru, Hubballi & chapters" },
    { id: makeId(), title: "Kerala State", description: "Kochi, Thiruvananthapuram & academies" },
    { id: makeId(), title: "Andhra Pradesh", description: "Visakhapatnam, Vijayawada & zones" },
    { id: makeId(), title: "Telangana State", description: "Hyderabad, Warangal & sports bodies" },
    { id: makeId(), title: "Delhi Capital", description: "NCR, New Delhi & central trials" },
    { id: makeId(), title: "Maharashtra State", description: "Mumbai, Pune, Nagpur & districts" },
    { id: makeId(), title: "Uttar Pradesh", description: "Lucknow, Kanpur, Varanasi & centers" },
    { id: makeId(), title: "Punjab State", description: "Ludhiana, Jalandhar, Amritsar & camps" },
    { id: makeId(), title: "All Other States", description: "Direct national secretariat accreditation" }
  ];

  const statesDirNode = {
    nodeId: statesDirId,
    type: "interactive",
    name: "State Associations",
    interactiveId: exploreRows[4].id,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 750, y: 950 },
    keywords: ["Select State"],
    data: {
      interactiveType: "list",
      body: "📍 *ISYDCI State & Zone Chapters*\n\nSelect your state or regional chapter for local trial dates and coordinator contact:",
      header: { type: "none", text: "" },
      footer: "Select your state",
      action: {
        button: "Choose State",
        sections: [
          { title: "South Zone", rows: stateRows.slice(0, 5) },
          { title: "North & Central", rows: stateRows.slice(5) }
        ],
        dynamicRows: { enabled: false }
      }
    }
  };

  // 11. State Chapter Details
  const stateBtnReg = makeId();
  const stateBtnSec = makeId();
  const stateBtnMenu = makeId();

  const stateDetailNode = {
    nodeId: stateDetailId,
    type: "interactive",
    name: "State Chapter Details",
    interactiveId: stateRows[0].id,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 1100, y: 950 },
    keywords: ["Tamil Nadu State"],
    data: {
      interactiveType: "button",
      body: "🏛️ *State Chapter & Trials Information*\n\nState trials are conducted bi-annually. All registered ISYDCI members are eligible to attend trials for state team selection.\n\nNeed direct assistance from state coordinators?",
      header: { type: "text", text: "State Association" },
      footer: "ISYDCI State Chapter",
      action: {
        buttons: [
          { type: "reply", reply: { id: stateBtnReg, title: "Register" } },
          { type: "reply", reply: { id: stateBtnSec, title: "ISYDCI Secretariat" } },
          { type: "reply", reply: { id: stateBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // 12. ISYDCI Secretariat Info
  const secBtnSupp = makeId();
  const secBtnReg = makeId();
  const secBtnMenu = makeId();

  const secretariatNode = {
    nodeId: secretariatId,
    type: "interactive",
    name: "ISYDCI Secretariat Info",
    interactiveId: exploreRows[5].id,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 750, y: 1200 },
    keywords: ["ISYDCI Secretariat"],
    data: {
      interactiveType: "button",
      body: "🏛️ *National Secretariat Desk*\n\nInternational Sports & Youth Development Campaign / Indian Sports Youth Development Council of India\n\n📍 Address: VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001\n📜 Reg No: 49/1997\n🌐 Web: https://isydci.vercel.app\n\nNeed immediate support?",
      header: { type: "text", text: "HQ Secretariat" },
      footer: "New Delhi Central Office",
      action: {
        buttons: [
          { type: "reply", reply: { id: secBtnSupp, title: "Contact Support" } },
          { type: "reply", reply: { id: secBtnReg, title: "Register" } },
          { type: "reply", reply: { id: secBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  const nodes = [
    rootNode,
    unifiedRegCardNode,
    regFormNode,
    regCompleteNode,
    exploreNode,
    tournInfoNode,
    eventsNode,
    rosterNode,
    sportsDirNode,
    sportOverviewNode,
    statesDirNode,
    stateDetailNode,
    secretariatNode
  ];

  // EDGES
  // Both "Register" and "Membership Card" lead directly to the unified node!
  const edges = [
    // From Root
    { id: makeId(), fromNodeId: rootId, toNodeId: unifiedRegCardId, keywords: ["Register"], intentName: "Register", delay: 0 },
    { id: makeId(), fromNodeId: rootId, toNodeId: unifiedRegCardId, keywords: ["Membership Card"], intentName: "Membership Card", delay: 0 },
    { id: makeId(), fromNodeId: rootId, toNodeId: exploreMenuId, keywords: ["Explore ISYDCI"], intentName: "Explore ISYDCI", delay: 0 },

    // From Unified Registration & ID Card Node
    { id: makeId(), fromNodeId: unifiedRegCardId, toNodeId: regFormId, keywords: ["Complete Registration"], intentName: "Complete Registration", delay: 0 },
    { id: makeId(), fromNodeId: unifiedRegCardId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },
    // Note: "Verify Membership" is handled by backend webhook -> no edge needed

    // From Registration Form Step
    { id: makeId(), fromNodeId: regFormId, toNodeId: regCompleteId, keywords: ["Confirm & Issue Card"], intentName: "Confirm & Issue Card", delay: 0 },
    { id: makeId(), fromNodeId: regFormId, toNodeId: sportsDirId, keywords: ["Select Sport"], intentName: "Select Sport", delay: 0 },
    { id: makeId(), fromNodeId: regFormId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },

    // From Registration Complete & ID Card Delivery
    // Note: "Download ID Card" is handled by backend webhook -> returns Cloudinary card PNG
    { id: makeId(), fromNodeId: regCompleteId, toNodeId: tournInfoId, keywords: ["Tournament Info"], intentName: "Tournament Info", delay: 0 },
    { id: makeId(), fromNodeId: regCompleteId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },

    // From Explore Services Menu
    { id: makeId(), fromNodeId: exploreMenuId, toNodeId: tournInfoId, keywords: ["Tournament Info"], intentName: "Tournament Info", delay: 0 },
    { id: makeId(), fromNodeId: exploreMenuId, toNodeId: eventsId, keywords: ["Upcoming Events"], intentName: "Upcoming Events", delay: 0 },
    { id: makeId(), fromNodeId: exploreMenuId, toNodeId: rosterId, keywords: ["Athletes Roster"], intentName: "Athletes Roster", delay: 0 },
    { id: makeId(), fromNodeId: exploreMenuId, toNodeId: sportsDirId, keywords: ["Select Sport"], intentName: "Select Sport", delay: 0 },
    { id: makeId(), fromNodeId: exploreMenuId, toNodeId: statesDirId, keywords: ["Select State"], intentName: "Select State", delay: 0 },
    { id: makeId(), fromNodeId: exploreMenuId, toNodeId: secretariatId, keywords: ["ISYDCI Secretariat"], intentName: "ISYDCI Secretariat", delay: 0 },
    { id: makeId(), fromNodeId: exploreMenuId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },

    // From National Championship Info
    { id: makeId(), fromNodeId: tournInfoId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },

    // From Upcoming Events & Trials
    { id: makeId(), fromNodeId: eventsId, toNodeId: rosterId, keywords: ["Athletes Roster"], intentName: "Athletes Roster", delay: 0 },
    { id: makeId(), fromNodeId: eventsId, toNodeId: tournInfoId, keywords: ["Tournament Info"], intentName: "Tournament Info", delay: 0 },
    { id: makeId(), fromNodeId: eventsId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },

    // From Featured Athletes Roster
    { id: makeId(), fromNodeId: rosterId, toNodeId: unifiedRegCardId, keywords: ["Register"], intentName: "Register", delay: 0 },
    { id: makeId(), fromNodeId: rosterId, toNodeId: sportsDirId, keywords: ["Select Sport"], intentName: "Select Sport", delay: 0 },
    { id: makeId(), fromNodeId: rosterId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },

    // From Sport Category Overview
    { id: makeId(), fromNodeId: sportOverviewId, toNodeId: unifiedRegCardId, keywords: ["Register"], intentName: "Register", delay: 0 },
    { id: makeId(), fromNodeId: sportOverviewId, toNodeId: statesDirId, keywords: ["Select State"], intentName: "Select State", delay: 0 },
    { id: makeId(), fromNodeId: sportOverviewId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },

    // From State Chapter Details
    { id: makeId(), fromNodeId: stateDetailId, toNodeId: unifiedRegCardId, keywords: ["Register"], intentName: "Register", delay: 0 },
    { id: makeId(), fromNodeId: stateDetailId, toNodeId: secretariatId, keywords: ["ISYDCI Secretariat"], intentName: "ISYDCI Secretariat", delay: 0 },
    { id: makeId(), fromNodeId: stateDetailId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 },

    // From ISYDCI Secretariat Info
    { id: makeId(), fromNodeId: secretariatId, toNodeId: unifiedRegCardId, keywords: ["Register"], intentName: "Register", delay: 0 },
    { id: makeId(), fromNodeId: secretariatId, toNodeId: rootId, keywords: ["Main Menu"], intentName: "Main Menu", delay: 0 }
  ];

  // Add edges for all sports rows to sportOverviewId
  sportsRows.forEach(sRow => {
    edges.push({
      id: makeId(),
      fromNodeId: sportsDirId,
      toNodeId: sportOverviewId,
      keywords: [sRow.title],
      intentName: sRow.title,
      delay: 0
    });
  });

  // Add edges for all state rows to stateDetailId
  stateRows.forEach(stRow => {
    edges.push({
      id: makeId(),
      fromNodeId: statesDirId,
      toNodeId: stateDetailId,
      keywords: [stRow.title],
      intentName: stRow.title,
      delay: 0
    });
  });

  return {
    chatbot: {
      name: "ISYDCI-Official-Bot-v1",
      description: "Indian Sports Youth Development Council of India Unified Registration & Membership Card Flow"
    },
    manualResolution: false,
    nodes,
    edges
  };
}

const flow = buildFlow();
fs.writeFileSync('wacto/isydci_flow_v1.json', JSON.stringify(flow, null, 2), 'utf-8');
fs.writeFileSync('src/data/isydci_flow_v1.json', JSON.stringify(flow, null, 2), 'utf-8');
console.log('Successfully generated unified flow with', flow.nodes.length, 'nodes and', flow.edges.length, 'edges');
