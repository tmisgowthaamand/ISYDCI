const fs = require('fs');

function makeId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function buildFlow() {
  const rootId = "root";
  const aboutId = makeId();
  const websiteId = makeId();
  const contactId = makeId();
  
  // 8-Screen Registration Flow Nodes
  const regStep1LocationId = makeId();
  const regStep2DobId = makeId();
  const regStep3AddressId = makeId();
  const regStep4PhotoId = makeId();
  const regStep5ConfirmId = makeId();
  const regStep6SubmittedId = makeId();
  const regStep7CardReadyId = makeId();

  // Root Menu Row IDs
  const rootRowReg = makeId();
  const rootRowCard = makeId();
  const rootRowAbout = makeId();
  const rootRowWebsite = makeId();
  const rootRowContact = makeId();

  // -------------------------------------------------------------
  // Screen 1: Root Menu (Interactive List)
  // -------------------------------------------------------------
  const rootNode = {
    nodeId: rootId,
    type: "interactive",
    name: "ISYDCI Official Welcome & Menu",
    interactiveId: null,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 100, y: 100 },
    keywords: ["hi", "hello", "hey", "start", "menu", "isydci"],
    data: {
      interactiveType: "list",
      body: "🏆 *Welcome to Indian Sports Youth Development Council of India (ISYDCI)*!\n\nOfficial National Sports Council accreditation & athlete membership portal.\n\n📍 Ministry Reg No: 49/1997 | New Delhi HQ\n\nPlease tap below to choose an option:",
      header: { type: "text", text: "ISYDCI National Council" },
      footer: "Official WhatsApp Athlete Portal",
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: makeId(),
              title: "Choose Option"
            }
          }
        ],
        sections: [
          {
            title: "Athlete Membership",
            rows: [
              {
                id: rootRowReg,
                title: "Register Athlete",
                description: "New membership registration & ID card issuance"
              },
              {
                id: rootRowCard,
                title: "My Membership Card",
                description: "View & download front & back official ID card"
              }
            ]
          },
          {
            title: "Council Information",
            rows: [
              {
                id: rootRowAbout,
                title: "About ISYDCI",
                description: "Council accreditation & ministry recognition 49/1997"
              },
              {
                id: rootRowWebsite,
                title: "Official Website",
                description: "Visit https://isydci.org for athlete portal"
              },
              {
                id: rootRowContact,
                title: "Contact Support",
                description: "Helpline: +91-99946 27551 & office details"
              }
            ]
          }
        ],
        button: "Choose Option"
      }
    }
  };

  // -------------------------------------------------------------
  // Council Info: About ISYDCI
  // -------------------------------------------------------------
  const aboutBtnWebsite = makeId();
  const aboutBtnMenu = makeId();

  const aboutNode = {
    nodeId: aboutId,
    type: "interactive",
    name: "About ISYDCI",
    interactiveId: rootRowAbout,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 500, y: -300 },
    keywords: ["About ISYDCI"],
    data: {
      interactiveType: "button",
      body: "🏛️ *About ISYDCI National Sports Council*\n\nIndian Sports & Youth Development Campaign (ISYDCI) is established under Society Registration Act (Reg No: 49/1997).\n\n🌟 *Key Objectives:*\n• Official athlete accreditation & verified digital membership card.\n• Organizing national trials, state selection camps, and national championships.\n• Official event venue: Talkatora Indoor Stadium, New Delhi.\n\n📍 Headquarters: VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001\n👤 Founder & National President: Visanath Shetty",
      header: { type: "text", text: "Council Accreditation" },
      footer: "Ministry Reg: 49/1997",
      action: {
        buttons: [
          { type: "reply", reply: { id: aboutBtnWebsite, title: "Official Website" } },
          { type: "reply", reply: { id: aboutBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Council Info: Official Website
  // -------------------------------------------------------------
  const webBtnContact = makeId();
  const webBtnMenu = makeId();

  const websiteNode = {
    nodeId: websiteId,
    type: "interactive",
    name: "Official Website",
    interactiveId: rootRowWebsite,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 500, y: -100 },
    keywords: ["Official Website"],
    data: {
      interactiveType: "button",
      body: "🌐 *Official ISYDCI Web Portal*\n\nVisit our official website to verify athlete credentials, view national championship fixtures, and download accreditation certificates:\n\n🔗 *Website:* https://isydci.org\n\n(Accredited under Society Reg No: 49/1997 | New Delhi HQ)",
      header: { type: "text", text: "Official Portal" },
      footer: "https://isydci.org",
      action: {
        buttons: [
          { type: "reply", reply: { id: webBtnContact, title: "Contact Support" } },
          { type: "reply", reply: { id: webBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Council Info: Contact Support
  // -------------------------------------------------------------
  const conBtnAbout = makeId();
  const conBtnMenu = makeId();

  const contactNode = {
    nodeId: contactId,
    type: "interactive",
    name: "Contact Support",
    interactiveId: rootRowContact,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 500, y: 100 },
    keywords: ["Contact Support"],
    data: {
      interactiveType: "button",
      body: "📞 *ISYDCI Council Secretariat & Help Desk*\n\n📱 *Helpline / WhatsApp:* +91-99946 27551\n📧 *Email:* support@isydci.org\n🌐 *Website:* https://isydci.org\n\n📍 *National Headquarters:*\nVB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001\n\nOffice Hours: Mon – Sat, 9:30 AM to 6:00 PM IST",
      header: { type: "text", text: "Helpline & Office" },
      footer: "+91-99946 27551",
      action: {
        buttons: [
          { type: "reply", reply: { id: conBtnAbout, title: "About ISYDCI" } },
          { type: "reply", reply: { id: conBtnMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Screen 2: Enter Location Details (State, District, Assembly, Zone)
  // -------------------------------------------------------------
  const btnLocNext = makeId();
  const btnLocMenu = makeId();

  const regStep1LocationNode = {
    nodeId: regStep1LocationId,
    type: "interactive",
    name: "Registration: Location Details",
    interactiveId: rootRowReg,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 900, y: -300 },
    keywords: ["Register Athlete"],
    data: {
      interactiveType: "button",
      body: "📝 *Athlete Registration (Step 1/5)*\n\nPlease enter your representation details:\n\n• Full Name: `Amit Kumar`\n• Mobile: `+91 98765 43210` (WhatsApp verified ✓)\n• State / UT: `Tamil Nadu`\n• District: `Chennai`\n• Assembly: `Velachery`\n• Zone / Ward / Area: `Ward 25`\n\n💬 *Type or tap Next to continue:*",
      header: { type: "text", text: "Athlete Registration" },
      footer: "Step 1 of 5: Location Details",
      action: {
        buttons: [
          { type: "reply", reply: { id: btnLocNext, title: "Next: Date of Birth" } },
          { type: "reply", reply: { id: btnLocMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Screen 3: Enter Date of Birth & Age
  // -------------------------------------------------------------
  const btnDobNext = makeId();
  const btnDobBack = makeId();

  const regStep2DobNode = {
    nodeId: regStep2DobId,
    type: "interactive",
    name: "Registration: Date of Birth & Age",
    interactiveId: btnLocNext,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 1200, y: -300 },
    keywords: ["Next: Date of Birth"],
    data: {
      interactiveType: "button",
      body: "🎂 *Date of Birth & Age (Step 2/5)*\n\nPlease provide your date of birth:\n\n📅 Date of Birth: `15 Aug 1999`\n⌛ Age: `27 Years` (Auto-calculated)\n\nℹ️ Age will be calculated automatically based on your date of birth.\n\n💬 *Type your DOB (e.g. 15 Aug 1999), or tap Next:*",
      header: { type: "text", text: "Date of Birth & Age" },
      footer: "Step 2 of 5: DOB & Age",
      action: {
        buttons: [
          { type: "reply", reply: { id: btnDobNext, title: "Next: Address Info" } },
          { type: "reply", reply: { id: btnDobBack, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Screen 4: Enter Remaining Details (Blood Group & Address)
  // -------------------------------------------------------------
  const btnAddrNext = makeId();
  const btnAddrMenu = makeId();

  const regStep3AddressNode = {
    nodeId: regStep3AddressId,
    type: "interactive",
    name: "Registration: Additional Information",
    interactiveId: btnDobNext,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 1500, y: -300 },
    keywords: ["Next: Address Info"],
    data: {
      interactiveType: "button",
      body: "🩸 *Additional Information (Step 3/5)*\n\nPlease complete the remaining details:\n\n• Blood Group: `O+`\n• Full Address:\n`No. 12, 3rd Street, Velachery, Chennai - 600042, Tamil Nadu, India`\n\n💬 *Type your address in chat, or tap Next:*",
      header: { type: "text", text: "Additional Information" },
      footer: "Step 3 of 5: Blood & Address",
      action: {
        buttons: [
          { type: "reply", reply: { id: btnAddrNext, title: "Next: Upload Photo" } },
          { type: "reply", reply: { id: btnAddrMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Screen 5: Upload Photo (Athlete Photo)
  // -------------------------------------------------------------
  const btnPhotoNext = makeId();
  const btnPhotoMenu = makeId();

  const regStep4PhotoNode = {
    nodeId: regStep4PhotoId,
    type: "interactive",
    name: "Registration: Upload Photo",
    interactiveId: btnAddrNext,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 1800, y: -300 },
    keywords: ["Next: Upload Photo"],
    data: {
      interactiveType: "button",
      body: "📸 *Upload Your Photo (Step 4/5)*\n\nPlease upload a clear passport size photo for your official ISYDCI athlete ID card.\n\nRecommended: 300 DPI, plain background.\nYour photo will be cropped to 137×136 ratio.\n\nTap below to review your complete details:",
      header: { type: "text", text: "Upload Your Photo" },
      footer: "Step 4 of 5: Passport Photo",
      action: {
        buttons: [
          { type: "reply", reply: { id: btnPhotoNext, title: "Next: Review Details" } },
          { type: "reply", reply: { id: btnPhotoMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Screen 6: Confirm Your Details (Review before submission)
  // -------------------------------------------------------------
  const btnSubmitReg = makeId();
  const btnConfirmMenu = makeId();

  const regStep5ConfirmNode = {
    nodeId: regStep5ConfirmId,
    type: "interactive",
    name: "Registration: Confirm Your Details",
    interactiveId: btnPhotoNext,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 2100, y: -300 },
    keywords: ["Next: Review Details"],
    data: {
      interactiveType: "button",
      body: "📋 *Confirm Your Details (Step 5/5)*\n\nPlease review your details before submitting:\n\n👤 Full Name: `Amit Kumar`\n📱 Mobile: `+91 98765 43210`\n📍 State: `Tamil Nadu` | District: `Chennai`\n🏛️ Assembly: `Velachery` | Zone: `Ward 25`\n🎂 DOB: `15 Aug 1999` (Age 27)\n🩸 Blood Group: `O+`\n🏠 Address: `No. 12, 3rd Street, Velachery, Chennai - 600042`\n📷 Passport Photo: `Fitted 137×136 ✓`\n\n✅ *Please confirm that all the details are correct.*",
      header: { type: "text", text: "Confirm Your Details" },
      footer: "Review Before Submission",
      action: {
        buttons: [
          { type: "reply", reply: { id: btnSubmitReg, title: "Submit Registration" } },
          { type: "reply", reply: { id: btnConfirmMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Screen 7: Registration Submitted (Success message)
  // -------------------------------------------------------------
  const btnViewCard = makeId();
  const btnSubmittedMenu = makeId();

  const regStep6SubmittedNode = {
    nodeId: regStep6SubmittedId,
    type: "interactive",
    name: "Registration Submitted",
    interactiveId: btnSubmitReg,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 2400, y: -300 },
    keywords: ["Submit Registration"],
    data: {
      interactiveType: "button",
      body: "✅ *Registration Submitted!*\n\nThank you for registering with ISYDCI. Your details have been successfully submitted.\n\n🪪 *Membership ID:* `ISYDCI-684DDC04`\n\nYour official membership card is being generated and will be shown below:\n\n⏳ Generating your ISYDCI Member Card... Please wait a moment.",
      header: { type: "text", text: "Registration Submitted" },
      footer: "ISYDCI National Sports Council",
      action: {
        buttons: [
          { type: "reply", reply: { id: btnViewCard, title: "View Membership Card" } },
          { type: "reply", reply: { id: btnSubmittedMenu, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // -------------------------------------------------------------
  // Screen 8: Your ISYDCI Member Card (Show immediately after submission)
  // -------------------------------------------------------------
  const finalBtnDownload = makeId();
  const finalBtnShare = makeId();
  const finalBtnClose = makeId();

  const regStep7CardReadyNode = {
    nodeId: regStep7CardReadyId,
    type: "interactive",
    name: "Your ISYDCI Member Card",
    interactiveId: btnViewCard,
    assignedAgent: null,
    assignedAgents: [],
    enabledNotify: false,
    notifyConfig: {},
    funnelStageConfig: { enabled: false },
    variableConfig: {},
    canvasPosition: { x: 2700, y: -300 },
    keywords: ["View Membership Card"],
    data: {
      interactiveType: "button",
      body: "🎉 *Your ISYDCI Membership Card is Ready!*\n\nHere is your official membership card (Front & Back Side):\n\n• Verified Athlete Member\n• Council Reg No: 49/1997\n• High-Resolution Digital Card Generated\n\nTap below to download or share your card:",
      header: { type: "text", text: "Your ISYDCI Member Card" },
      footer: "Official Council Card",
      action: {
        buttons: [
          { type: "reply", reply: { id: finalBtnDownload, title: "Download Card" } },
          { type: "reply", reply: { id: finalBtnShare, title: "Share Card" } },
          { type: "reply", reply: { id: finalBtnClose, title: "Main Menu" } }
        ],
        sections: [],
        button: ""
      }
    }
  };

  // Assemble Nodes
  const nodes = [
    rootNode,
    aboutNode,
    websiteNode,
    contactNode,
    regStep1LocationNode,
    regStep2DobNode,
    regStep3AddressNode,
    regStep4PhotoNode,
    regStep5ConfirmNode,
    regStep6SubmittedNode,
    regStep7CardReadyNode
  ];

  // -------------------------------------------------------------
  // Edges (Routing)
  // -------------------------------------------------------------
  const edges = [];

  function addEdge(fromId, toId, keywords, intent = "user_reply") {
    edges.push({
      fromNodeId: fromId,
      toNodeId: toId,
      keywords: Array.isArray(keywords) ? keywords : [keywords],
      intentName: intent,
      delay: 0
    });
  }

  // From Root Menu
  addEdge(rootId, regStep1LocationId, ["Register Athlete"]);
  addEdge(rootId, aboutId, ["About ISYDCI"]);
  addEdge(rootId, websiteId, ["Official Website"]);
  addEdge(rootId, contactId, ["Contact Support"]);

  // From About
  addEdge(aboutId, websiteId, ["Official Website"]);
  addEdge(aboutId, rootId, ["Main Menu"]);

  // From Website
  addEdge(websiteId, contactId, ["Contact Support"]);
  addEdge(websiteId, rootId, ["Main Menu"]);

  // From Contact
  addEdge(contactId, aboutId, ["About ISYDCI"]);
  addEdge(contactId, rootId, ["Main Menu"]);

  // 8-Screen Registration Chain:
  // Screen 2 -> Screen 3 (Location -> DOB)
  addEdge(regStep1LocationId, regStep2DobId, ["Next: Date of Birth"]);
  addEdge(regStep1LocationId, rootId, ["Main Menu"]);

  // Screen 3 -> Screen 4 (DOB -> Address)
  addEdge(regStep2DobId, regStep3AddressId, ["Next: Address Info"]);
  addEdge(regStep2DobId, rootId, ["Main Menu"]);

  // Screen 4 -> Screen 5 (Address -> Photo)
  addEdge(regStep3AddressId, regStep4PhotoId, ["Next: Upload Photo"]);
  addEdge(regStep3AddressId, rootId, ["Main Menu"]);

  // Screen 5 -> Screen 6 (Photo -> Confirm Details)
  addEdge(regStep4PhotoId, regStep5ConfirmId, ["Next: Review Details"]);
  addEdge(regStep4PhotoId, rootId, ["Main Menu"]);

  // Screen 6 -> Screen 7 (Confirm Details -> Registration Submitted)
  addEdge(regStep5ConfirmId, regStep6SubmittedId, ["Submit Registration"]);
  addEdge(regStep5ConfirmId, rootId, ["Main Menu"]);

  // Screen 7 -> Screen 8 (Registration Submitted -> Member Card Ready)
  addEdge(regStep6SubmittedId, regStep7CardReadyNode.nodeId, ["View Membership Card"]);
  addEdge(regStep6SubmittedId, rootId, ["Main Menu"]);

  // Screen 8 -> Root Menu
  addEdge(regStep7CardReadyId, rootId, ["Main Menu"]);

  return {
    chatbot: {
      name: "ISYDCI Official Bot v2 (EDMS Pattern)"
    },
    nodes,
    edges,
    manualResolution: {
      enabled: false,
      title: "Manual Resolution"
    }
  };
}

const flow = buildFlow();
fs.writeFileSync('wacto/isydci_flow_v1.json', JSON.stringify(flow, null, 2), 'utf8');
fs.writeFileSync('src/data/isydci_flow_v1.json', JSON.stringify(flow, null, 2), 'utf8');
console.log(`Successfully generated flow: ${flow.nodes.length} nodes, ${flow.edges.length} edges.`);
