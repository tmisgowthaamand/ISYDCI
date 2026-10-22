const fs = require('fs');
const path = require('path');

const token = process.env.WHATSAPP_TOKEN || 'EAAMybsyZChV4BRZClZCQV4YxSzrpc0j17nWJ1LDQ2sUIlg0ftzxpmyGpFzxCZAD7ysR8SAw1KdEHHMpNY5kZBizoCdr4G3F7THBjtc1ZAOnQZBAl45xSE8vPsyw5blmUfUgVXV28RgB7fZBDantUZBBsv2PzMaMW8KZA0cPicvZAqA84TDeEcoDdDbkJWcoEob0FyHnZCgZDZD';
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1489660795854064';

const flowJson = {
  version: "6.0",
  data_api_version: "3.0",
  routing_model: {
    WELCOME: ["PERSONAL_INFO"],
    PERSONAL_INFO: ["SPORT_INFO"],
    SPORT_INFO: ["LOCATION_INFO"],
    LOCATION_INFO: ["CONFIRMATION"],
    CONFIRMATION: ["SUCCESS"],
    SUCCESS: []
  },
  screens: [
    {
      id: "WELCOME",
      title: "ISYDCI Sports Council",
      terminal: false,
      data: {},
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "TextHeading",
            text: "🏆 ISYDCI National Sports Portal"
          },
          {
            type: "TextSubheading",
            text: "Indian Sports Youth Development Council of India"
          },
          {
            type: "TextBody",
            text: "Reg No: 49/1997 | New Delhi HQ\n\nOfficial athlete membership & national accreditation portal.\n\nPlease select your membership category below to start your registration."
          },
          {
            type: "Form",
            name: "welcome_form",
            children: [
              {
                type: "RadioButtonsGroup",
                name: "member_category",
                label: "Select Membership Category",
                required: true,
                "data-source": [
                  {
                    id: "senior_athlete",
                    title: "Senior Athlete (19+ years)"
                  },
                  {
                    id: "junior_athlete",
                    title: "Junior Athlete (14 - 18 years)"
                  },
                  {
                    id: "sub_junior",
                    title: "Sub-Junior Athlete (Under 14 years)"
                  },
                  {
                    id: "coach_official",
                    title: "Coach / Technical Official"
                  },
                  {
                    id: "state_official",
                    title: "State / District Representative"
                  }
                ]
              },
              {
                type: "Footer",
                label: "Continue to Personal Info",
                "on-click-action": {
                  name: "navigate",
                  next: {
                    type: "screen",
                    name: "PERSONAL_INFO"
                  },
                  payload: {
                    member_category: "${form.member_category}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "PERSONAL_INFO",
      title: "Athlete Details",
      terminal: false,
      data: {
        member_category: {
          type: "string",
          __example__: "senior_athlete"
        }
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "TextHeading",
            text: "Personal Credentials"
          },
          {
            type: "TextBody",
            text: "Please enter your details as registered in official Government ID."
          },
          {
            type: "Form",
            name: "personal_form",
            children: [
              {
                type: "TextInput",
                name: "full_name",
                label: "Full Name (as per Govt ID)",
                required: true
              },
              {
                type: "TextInput",
                name: "dob",
                label: "Date of Birth (DD/MM/YYYY)",
                required: true
              },
              {
                type: "RadioButtonsGroup",
                name: "gender",
                label: "Gender",
                required: true,
                "data-source": [
                  {
                    id: "male",
                    title: "Male"
                  },
                  {
                    id: "female",
                    title: "Female"
                  },
                  {
                    id: "other",
                    title: "Other"
                  }
                ]
              },
              {
                type: "TextInput",
                name: "contact_number",
                label: "WhatsApp / Mobile Number",
                "input-type": "phone",
                required: true
              },
              {
                type: "Footer",
                label: "Continue to Sport Selection",
                "on-click-action": {
                  name: "navigate",
                  next: {
                    type: "screen",
                    name: "SPORT_INFO"
                  },
                  payload: {
                    member_category: "${data.member_category}",
                    full_name: "${form.full_name}",
                    dob: "${form.dob}",
                    gender: "${form.gender}",
                    contact_number: "${form.contact_number}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "SPORT_INFO",
      title: "Sport & Discipline",
      terminal: false,
      data: {
        member_category: {
          type: "string",
          __example__: "senior_athlete"
        },
        full_name: {
          type: "string",
          __example__: "Amit Kumar"
        },
        dob: {
          type: "string",
          __example__: "15/08/2002"
        },
        gender: {
          type: "string",
          __example__: "male"
        },
        contact_number: {
          type: "string",
          __example__: "+919994627551"
        }
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "TextHeading",
            text: "Sport & Discipline"
          },
          {
            type: "TextBody",
            text: "Choose your primary sports discipline and tournament level."
          },
          {
            type: "Form",
            name: "sport_form",
            children: [
              {
                type: "Dropdown",
                name: "primary_sport",
                label: "Primary Sport",
                required: true,
                "data-source": [
                  { id: "athletics", title: "Athletics (Track & Field)" },
                  { id: "badminton", title: "Badminton" },
                  { id: "basketball", title: "Basketball" },
                  { id: "boxing", title: "Boxing" },
                  { id: "cricket", title: "Cricket" },
                  { id: "football", title: "Football" },
                  { id: "swimming", title: "Swimming" },
                  { id: "taekwondo", title: "Taekwondo / Martial Arts" },
                  { id: "volleyball", title: "Volleyball" },
                  { id: "wrestling", title: "Wrestling" },
                  { id: "kabaddi", title: "Kabaddi" },
                  { id: "table_tennis", title: "Table Tennis" },
                  { id: "archery", title: "Archery" },
                  { id: "shooting", title: "Shooting" },
                  { id: "other", title: "Other Recognized Sport" }
                ]
              },
              {
                type: "TextInput",
                name: "event_name",
                label: "Event / Weight Category (e.g. 100m, Singles, 68kg)",
                required: true
              },
              {
                type: "RadioButtonsGroup",
                name: "highest_level",
                label: "Highest Participation Level",
                required: true,
                "data-source": [
                  { id: "district", title: "District / School Level" },
                  { id: "state", title: "State Level Championship" },
                  { id: "national", title: "National Championship & Trials" },
                  { id: "international", title: "International Representation" }
                ]
              },
              {
                type: "Footer",
                label: "Continue to Location",
                "on-click-action": {
                  name: "navigate",
                  next: {
                    type: "screen",
                    name: "LOCATION_INFO"
                  },
                  payload: {
                    member_category: "${data.member_category}",
                    full_name: "${data.full_name}",
                    dob: "${data.dob}",
                    gender: "${data.gender}",
                    contact_number: "${data.contact_number}",
                    primary_sport: "${form.primary_sport}",
                    event_name: "${form.event_name}",
                    highest_level: "${form.highest_level}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "LOCATION_INFO",
      title: "State & District",
      terminal: false,
      data: {
        member_category: { type: "string", __example__: "senior_athlete" },
        full_name: { type: "string", __example__: "Amit Kumar" },
        dob: { type: "string", __example__: "15/08/2002" },
        gender: { type: "string", __example__: "male" },
        contact_number: { type: "string", __example__: "+919994627551" },
        primary_sport: { type: "string", __example__: "athletics" },
        event_name: { type: "string", __example__: "100m Sprint" },
        highest_level: { type: "string", __example__: "national" }
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "TextHeading",
            text: "State Council & Chapter"
          },
          {
            type: "TextBody",
            text: "Select your affiliated state chapter and home district."
          },
          {
            type: "Form",
            name: "location_form",
            children: [
              {
                type: "Dropdown",
                name: "state",
                label: "State / UT",
                required: true,
                "data-source": [
                  { id: "delhi", title: "Delhi (HQ Chapter)" },
                  { id: "tamil_nadu", title: "Tamil Nadu" },
                  { id: "maharashtra", title: "Maharashtra" },
                  { id: "karnataka", title: "Karnataka" },
                  { id: "uttar_pradesh", title: "Uttar Pradesh" },
                  { id: "punjab", title: "Punjab" },
                  { id: "haryana", title: "Haryana" },
                  { id: "kerala", title: "Kerala" },
                  { id: "gujarat", title: "Gujarat" },
                  { id: "rajasthan", title: "Rajasthan" },
                  { id: "west_bengal", title: "West Bengal" },
                  { id: "telangana", title: "Telangana" },
                  { id: "andhra_pradesh", title: "Andhra Pradesh" },
                  { id: "bihar", title: "Bihar" },
                  { id: "madhya_pradesh", title: "Madhya Pradesh" },
                  { id: "odisha", title: "Odisha" },
                  { id: "assam", title: "Assam" },
                  { id: "other", title: "Other State / UT" }
                ]
              },
              {
                type: "TextInput",
                name: "district",
                label: "District / City",
                required: true
              },
              {
                type: "TextInput",
                name: "club_name",
                label: "Club / Academy / Institution (Optional)",
                required: false
              },
              {
                type: "Footer",
                label: "Review Application",
                "on-click-action": {
                  name: "navigate",
                  next: {
                    type: "screen",
                    name: "CONFIRMATION"
                  },
                  payload: {
                    member_category: "${data.member_category}",
                    full_name: "${data.full_name}",
                    dob: "${data.dob}",
                    gender: "${data.gender}",
                    contact_number: "${data.contact_number}",
                    primary_sport: "${data.primary_sport}",
                    event_name: "${data.event_name}",
                    highest_level: "${data.highest_level}",
                    state: "${form.state}",
                    district: "${form.district}",
                    club_name: "${form.club_name}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "CONFIRMATION",
      title: "Review & Submit",
      terminal: false,
      data: {
        member_category: { type: "string", __example__: "senior_athlete" },
        full_name: { type: "string", __example__: "Amit Kumar" },
        dob: { type: "string", __example__: "15/08/2002" },
        gender: { type: "string", __example__: "male" },
        contact_number: { type: "string", __example__: "+919994627551" },
        primary_sport: { type: "string", __example__: "athletics" },
        event_name: { type: "string", __example__: "100m Sprint" },
        highest_level: { type: "string", __example__: "national" },
        state: { type: "string", __example__: "delhi" },
        district: { type: "string", __example__: "New Delhi" },
        club_name: { type: "string", __example__: "National Stadium Club" }
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "TextHeading",
            text: "Application Summary"
          },
          {
            type: "TextBody",
            text: "• Athlete: ${data.full_name}\n• Category: ${data.member_category}\n• Sport: ${data.primary_sport} (${data.event_name})\n• Level: ${data.highest_level}\n• State / District: ${data.state}, ${data.district}\n• Mobile: ${data.contact_number}"
          },
          {
            type: "TextSubheading",
            text: "National Accreditation & ID Card"
          },
          {
            type: "TextBody",
            text: "Upon submission, your details will be verified with ISYDCI National Database for official digital ID card generation and championship eligibility."
          },
          {
            type: "Form",
            name: "confirm_form",
            children: [
              {
                type: "RadioButtonsGroup",
                name: "declaration",
                label: "Athlete Declaration",
                required: true,
                "data-source": [
                  {
                    id: "agree",
                    title: "I declare information is true & accept ISYDCI rules"
                  }
                ]
              },
              {
                type: "Footer",
                label: "Submit Application",
                "on-click-action": {
                  name: "navigate",
                  next: {
                    type: "screen",
                    name: "SUCCESS"
                  },
                  payload: {
                    member_category: "${data.member_category}",
                    full_name: "${data.full_name}",
                    dob: "${data.dob}",
                    gender: "${data.gender}",
                    contact_number: "${data.contact_number}",
                    primary_sport: "${data.primary_sport}",
                    event_name: "${data.event_name}",
                    highest_level: "${data.highest_level}",
                    state: "${data.state}",
                    district: "${data.district}",
                    club_name: "${data.club_name}",
                    declaration: "${form.declaration}"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "SUCCESS",
      title: "Application Received",
      terminal: true,
      data: {
        member_category: { type: "string", __example__: "senior_athlete" },
        full_name: { type: "string", __example__: "Amit Kumar" },
        primary_sport: { type: "string", __example__: "athletics" },
        state: { type: "string", __example__: "delhi" },
        district: { type: "string", __example__: "New Delhi" }
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "TextHeading",
            text: "🎉 Application Submitted!"
          },
          {
            type: "TextSubheading",
            text: "Indian Sports Youth Development Council of India"
          },
          {
            type: "TextBody",
            text: "Thank you! Your athlete registration has been submitted to ISYDCI National Secretariat (Reg No: 49/1997).\n\n📌 Verification: Council officials will review your submission.\n📌 Official Digital ID Card: Will be delivered directly to your WhatsApp.\n📌 Championships & Trials: Draw numbers and notifications will be sent to your phone.\n\nHelpline: +91 99946 27551\nOfficial Portal: https://isydci.vercel.app/"
          },
          {
            type: "Footer",
            label: "Done",
            "on-click-action": {
              name: "complete",
              payload: {
                status: "SUBMITTED",
                portal: "ISYDCI"
              }
            }
          }
        ]
      }
    }
  ]
};

async function main() {
  const filePath = path.join(__dirname, '..', 'wacto', 'isydci_flow.json');
  fs.writeFileSync(filePath, JSON.stringify(flowJson, null, 2), 'utf8');
  console.log('Saved flow JSON to:', filePath);

  console.log('\n--- Step 1: Creating fresh flow "isydci_flow" on Meta WABA ---');
  const createRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/flows`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'isydci_flow',
      categories: ['OTHER']
    })
  });

  const createData = await createRes.json();
  console.log('Create Response:', createData);
  if (!createData.id) {
    console.error('Failed to create flow:', createData);
    process.exit(1);
  }

  const flowId = createData.id;
  console.log('\n✅ Flow created with ID:', flowId);

  console.log('\n--- Step 2: Uploading flow.json asset ---');
  const blob = new Blob([JSON.stringify(flowJson)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');
  formData.append('file', blob, 'flow.json');

  const assetRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}/assets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const assetData = await assetRes.json();
  console.log('Asset Upload Response:', assetData);

  if (assetData.validation_errors && assetData.validation_errors.length > 0) {
    console.error('Validation errors found:', JSON.stringify(assetData.validation_errors, null, 2));
    process.exit(1);
  }

  console.log('\n--- Step 3: Publishing flow to LIVE ---');
  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const pubData = await pubRes.json();
  console.log('Publish Response:', pubData);

  console.log('\n--- Step 4: Fetching live flow details & preview URL ---');
  const detailRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}?fields=id,name,status,categories,preview,validation_errors`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const detailData = await detailRes.json();
  console.log('\n======================================================');
  console.log('🎯 LIVE META WHATSAPP FLOW CREATED & PUBLISHED:');
  console.log('Flow Name:', detailData.name);
  console.log('Flow ID:', detailData.id);
  console.log('Status:', detailData.status);
  console.log('Preview URL:', detailData.preview?.preview_url);
  console.log('Expires At:', detailData.preview?.expires_at);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
