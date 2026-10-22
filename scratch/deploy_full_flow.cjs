const fs = require('fs');
const path = require('path');
function loadEnv() {
  const envPath = path.resolve(__dirname, '../backend/.env');
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  });
}
loadEnv();

const token = process.env.WHATSAPP_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const flowId = process.env.WHATSAPP_FLOW_ID || '1702051681489130';
const endpoint = `${process.env.NGROK_URL}/api/whatsapp/flow-endpoint`;

const allStates = [
  { id: 'Andaman and Nicobar Islands', title: 'Andaman & Nicobar' },
  { id: 'Andhra Pradesh', title: 'Andhra Pradesh' },
  { id: 'Arunachal Pradesh', title: 'Arunachal Pradesh' },
  { id: 'Assam', title: 'Assam' },
  { id: 'Bihar', title: 'Bihar' },
  { id: 'Chandigarh', title: 'Chandigarh' },
  { id: 'Chhattisgarh', title: 'Chhattisgarh' },
  { id: 'Delhi', title: 'Delhi (HQ Chapter)' },
  { id: 'Goa', title: 'Goa' },
  { id: 'Gujarat', title: 'Gujarat' },
  { id: 'Haryana', title: 'Haryana' },
  { id: 'Himachal Pradesh', title: 'Himachal Pradesh' },
  { id: 'Jammu and Kashmir', title: 'Jammu & Kashmir' },
  { id: 'Jharkhand', title: 'Jharkhand' },
  { id: 'Karnataka', title: 'Karnataka' },
  { id: 'Kerala', title: 'Kerala' },
  { id: 'Ladakh', title: 'Ladakh' },
  { id: 'Madhya Pradesh', title: 'Madhya Pradesh' },
  { id: 'Maharashtra', title: 'Maharashtra' },
  { id: 'Manipur', title: 'Manipur' },
  { id: 'Meghalaya', title: 'Meghalaya' },
  { id: 'Mizoram', title: 'Mizoram' },
  { id: 'Nagaland', title: 'Nagaland' },
  { id: 'Odisha', title: 'Odisha' },
  { id: 'Puducherry', title: 'Puducherry' },
  { id: 'Punjab', title: 'Punjab' },
  { id: 'Rajasthan', title: 'Rajasthan' },
  { id: 'Sikkim', title: 'Sikkim' },
  { id: 'Tamil Nadu', title: 'Tamil Nadu' },
  { id: 'Telangana', title: 'Telangana' },
  { id: 'Tripura', title: 'Tripura' },
  { id: 'Uttar Pradesh', title: 'Uttar Pradesh' },
  { id: 'Uttarakhand', title: 'Uttarakhand' },
  { id: 'West Bengal', title: 'West Bengal' }
];

const sportsList = [
  { id: 'Athletics', title: 'Athletics (Track & Field)' },
  { id: 'Badminton', title: 'Badminton' },
  { id: 'Basketball', title: 'Basketball' },
  { id: 'Boxing', title: 'Boxing' },
  { id: 'Cricket', title: 'Cricket' },
  { id: 'Football', title: 'Football' },
  { id: 'Swimming', title: 'Swimming' },
  { id: 'Taekwondo', title: 'Taekwondo / Martial Arts' },
  { id: 'Volleyball', title: 'Volleyball' },
  { id: 'Wrestling', title: 'Wrestling' },
  { id: 'Kabaddi', title: 'Kabaddi' },
  { id: 'Table Tennis', title: 'Table Tennis' },
  { id: 'Archery', title: 'Archery' },
  { id: 'Shooting', title: 'Shooting' },
  { id: 'Other', title: 'Other Recognized Sport' }
];

const bloodGroups = [
  { id: 'O+', title: 'O+' },
  { id: 'A+', title: 'A+' },
  { id: 'B+', title: 'B+' },
  { id: 'AB+', title: 'AB+' },
  { id: 'O-', title: 'O-' },
  { id: 'A-', title: 'A-' },
  { id: 'B-', title: 'B-' },
  { id: 'AB-', title: 'AB-' }
];

const flowData = {
  version: '6.0',
  data_api_version: '3.0',
  routing_model: {
    ATHLETE_REGISTRATION: ['REG_SUCCESS'],
    REG_SUCCESS: [],
    WELCOME: [
      'ATHLETE_REGISTRATION',
      'MY_CARD',
      'ABOUT_ISYDCI',
      'CONTACT_SUPPORT'
    ],
    MY_CARD: ['CARD_VIEW'],
    CARD_VIEW: [],
    ABOUT_ISYDCI: [],
    CONTACT_SUPPORT: []
  },
  screens: [
    // -------------------------------------------------------------
    // Screen 1: 1-Step Athlete Registration (Primary Screen)
    // -------------------------------------------------------------
    {
      id: 'ATHLETE_REGISTRATION',
      title: 'Athlete Registration',
      terminal: false,
      data: {
        contact_number: { type: 'string', __example__: '+91 91234 56789' }
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: 'Athlete Registration'
          },
          {
            type: 'TextSubheading',
            text: 'Please enter your location details.'
          },
          {
            type: 'TextBody',
            text: '📍 Ministry Reg No: 49/1997 | New Delhi HQ\nComplete your official membership registration in 1 simple step.'
          },
          {
            type: 'Form',
            name: 'athlete_reg_form',
            children: [
              {
                type: 'TextInput',
                name: 'full_name',
                label: 'Full Name *',
                required: true,
                'helper-text': 'Official name as per Govt ID'
              },
              {
                type: 'TextInput',
                name: 'contact_number',
                label: 'Mobile Number',
                'input-type': 'phone',
                required: true,
                'helper-text': 'Automatically detected from WhatsApp'
              },
              {
                type: 'Dropdown',
                name: 'state',
                label: 'State / Union Territory *',
                required: true,
                'data-source': allStates
              },
              {
                type: 'TextInput',
                name: 'district',
                label: 'District *',
                required: true,
                'helper-text': 'e.g. Chennai'
              },
              {
                type: 'TextInput',
                name: 'assembly',
                label: 'Assembly / Constituency *',
                required: true,
                'helper-text': 'e.g. Velachery'
              },
              {
                type: 'TextInput',
                name: 'zone',
                label: 'Zone / Ward / Area *',
                required: true,
                'helper-text': 'e.g. Ward 25'
              },
              {
                type: 'TextInput',
                name: 'dob',
                label: 'Date of Birth *',
                required: true,
                'helper-text': 'e.g. 15 Aug 1999 (Age is auto-calculated)'
              },
              {
                type: 'TextInput',
                name: 'age',
                label: 'Age',
                required: false,
                'helper-text': 'e.g. 27 Years'
              },
              {
                type: 'Dropdown',
                name: 'blood_group',
                label: 'Blood Group *',
                required: true,
                'data-source': bloodGroups
              },
              {
                type: 'TextInput',
                name: 'address',
                label: 'Full Address *',
                required: true,
                'helper-text': 'No. 12, 3rd Street, Velachery, Chennai'
              },
              {
                type: 'RadioButtonsGroup',
                name: 'photo_option',
                label: 'Upload Your Photo',
                required: true,
                'data-source': [
                  {
                    id: 'passport_photo',
                    title: 'Passport Photo (300 DPI | JPG/PNG)',
                    description: 'Clear passport photo for verified ID card'
                  }
                ]
              },
              {
                type: 'RadioButtonsGroup',
                name: 'confirmation',
                label: 'Declaration',
                required: true,
                'data-source': [
                  {
                    id: 'confirmed',
                    title: '✓ Please confirm that all the details are correct.'
                  }
                ]
              },
              {
                type: 'Footer',
                label: 'Submit Registration',
                'on-click-action': {
                  name: 'data_exchange',
                  payload: {
                    screen: 'ATHLETE_REGISTRATION',
                    full_name: '${form.full_name}',
                    contact_number: '${form.contact_number}',
                    state: '${form.state}',
                    district: '${form.district}',
                    assembly: '${form.assembly}',
                    zone: '${form.zone}',
                    dob: '${form.dob}',
                    age: '${form.age}',
                    blood_group: '${form.blood_group}',
                    address: '${form.address}'
                  }
                }
              }
            ]
          }
        ]
      }
    },

    // -------------------------------------------------------------
    // Screen 2: Welcome & Status Selection (Registered vs Unregistered)
    // -------------------------------------------------------------
    {
      id: 'WELCOME',
      title: 'ISYDCI Welcome & Menu',
      terminal: false,
      data: {},
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: 'ISYDCI National Council'
          },
          {
            type: 'TextSubheading',
            text: '🏆 Welcome to ISYDCI Sports Portal'
          },
          {
            type: 'TextBody',
            text: 'Official National Sports Council accreditation & athlete membership portal.\n\n📍 Ministry Reg No: 49/1997 | New Delhi HQ\n\nPlease select an option below to proceed:'
          },
          {
            type: 'Form',
            name: 'welcome_form',
            children: [
              {
                type: 'RadioButtonsGroup',
                name: 'menu_choice',
                label: 'Choose Option',
                required: true,
                'data-source': [
                  {
                    id: 'register',
                    title: 'Register Athlete (New Registration)',
                    description: 'New membership & digital ID card issuance'
                  },
                  {
                    id: 'card',
                    title: 'My Membership Card (Registered Athlete)',
                    description: 'View & download verified ID card'
                  },
                  {
                    id: 'about',
                    title: 'About ISYDCI',
                    description: 'Council accreditation & ministry recognition'
                  },
                  {
                    id: 'support',
                    title: 'Contact Support',
                    description: 'Helpline: +91 99946 27551 & office desk'
                  }
                ]
              },
              {
                type: 'Footer',
                label: 'Choose Option',
                'on-click-action': {
                  name: 'data_exchange',
                  payload: {
                    screen: 'WELCOME',
                    menu_choice: '${form.menu_choice}'
                  }
                }
              }
            ]
          }
        ]
      }
    },

    // -------------------------------------------------------------
    // Screen 6: Registration Success (Terminal)
    // -------------------------------------------------------------
    {
      id: 'REG_SUCCESS',
      title: 'Registration Completed',
      terminal: true,
      data: {
        name: { type: 'string', __example__: 'AMIT KUMAR' },
        member_id: { type: 'string', __example__: 'ISYDCI-684DDC04' },
        sport: { type: 'string', __example__: 'ATHLETICS' },
        state: { type: 'string', __example__: 'TAMIL NADU' }
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: '🎉 Application Submitted!'
          },
          {
            type: 'TextSubheading',
            text: 'Welcome to ISYDCI National Sports Community'
          },
          {
            type: 'TextBody',
            text: 'Thank you, ${data.name}!\n\nYour athlete registration has been registered with ISYDCI National Database (Reg No: 49/1997).\n\n🆔 Member ID: ${data.member_id}\n🥊 Primary Sport: ${data.sport}\n📍 Affiliated State: ${data.state}\n\n✅ Council Secretariat will verify and issue your Official Digital ID Card.\n✅ You will receive championship draws & event updates on WhatsApp.\n\nHelpline: +91 99946 27551\nOfficial Portal: https://isydci.vercel.app/'
          },
          {
            type: 'Footer',
            label: 'Done',
            'on-click-action': {
              name: 'complete',
              payload: {
                status: 'SUBMITTED',
                member_id: '${data.member_id}'
              }
            }
          }
        ]
      }
    },

    // -------------------------------------------------------------
    // Screen 7: My Membership Card (Registered Athlete)
    // -------------------------------------------------------------
    {
      id: 'MY_CARD',
      title: 'My Membership Card',
      terminal: false,
      data: {
        member_id: { type: 'string', __example__: '' },
        name: { type: 'string', __example__: '' },
        sport: { type: 'string', __example__: '' },
        state: { type: 'string', __example__: '' },
        district: { type: 'string', __example__: '' },
        status: { type: 'string', __example__: '' }
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: '🪪 Official ISYDCI Membership Card'
          },
          {
            type: 'TextSubheading',
            text: 'Athlete ID Verification & Card Delivery'
          },
          {
            type: 'TextBody',
            text: 'Indian Sports Youth Development Council of India\nMinistry Reg No: 49/1997 | New Delhi HQ\n\nEnter your Member ID or registered phone number to view and download your official Front & Back Digital ID card.'
          },
          {
            type: 'Form',
            name: 'lookup_form',
            children: [
              {
                type: 'TextInput',
                name: 'lookup_id',
                label: 'Member ID or 10-Digit Mobile Number',
                required: true
              },
              {
                type: 'Footer',
                label: 'Verify & View Card',
                'on-click-action': {
                  name: 'data_exchange',
                  payload: {
                    screen: 'MY_CARD',
                    lookup_id: '${form.lookup_id}'
                  }
                }
              }
            ]
          }
        ]
      }
    },

    // -------------------------------------------------------------
    // Screen 8: Card View & Download (Terminal)
    // -------------------------------------------------------------
    {
      id: 'CARD_VIEW',
      title: 'Athlete ID Card',
      terminal: true,
      data: {
        name: { type: 'string', __example__: 'AMIT KUMAR' },
        member_id: { type: 'string', __example__: 'ISYDCI-684DDC04' },
        sport: { type: 'string', __example__: 'ATHLETICS' },
        state: { type: 'string', __example__: 'Tamil Nadu' },
        district: { type: 'string', __example__: 'Chennai' },
        status: { type: 'string', __example__: 'Verified Athlete ✅' },
        dob: { type: 'string', __example__: '15 Aug 1999' },
        blood_group: { type: 'string', __example__: 'O+' }
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: '🪪 Verified Athlete Card'
          },
          {
            type: 'TextSubheading',
            text: 'ISYDCI Council Accreditation'
          },
          {
            type: 'TextBody',
            text: '👤 Athlete: ${data.name}\n🆔 Member ID: ${data.member_id}\n🥊 Sport: ${data.sport}\n📍 State: ${data.state} (${data.district})\n📅 DOB: ${data.dob}\n🩸 Blood Group: ${data.blood_group}\nStatus: ${data.status}\n\n📄 Official Front & Back digital ID card generated by Cloudinary is ready.'
          },
          {
            type: 'Footer',
            label: 'Download ID Card',
            'on-click-action': {
              name: 'complete',
              payload: {
                action: 'DOWNLOAD_CARD',
                member_id: '${data.member_id}',
                name: '${data.name}'
              }
            }
          }
        ]
      }
    },

    // -------------------------------------------------------------
    // Screen 9: About ISYDCI (Terminal)
    // -------------------------------------------------------------
    {
      id: 'ABOUT_ISYDCI',
      title: 'About ISYDCI',
      terminal: true,
      data: {},
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: '🏛️ ISYDCI National Sports Council'
          },
          {
            type: 'TextSubheading',
            text: 'Empowering Indian Athletes (Reg No: 49/1997)'
          },
          {
            type: 'TextBody',
            text: 'Indian Sports Youth Development Council of India (ISYDCI) is a national sports accreditation and championship organization.\n\n📍 Ministry Registration: 49/1997\n📍 Head Office: New Delhi, India\n📍 Core Initiatives:\n• National Championships & State Selection Trials\n• Athlete Accreditation & Official ID Cards\n• Coaching Camps & Talent Scouting\n• Athlete Welfare & Sports Insurance\n\nOfficial Portal: https://isydci.vercel.app/'
          },
          {
            type: 'Footer',
            label: 'Back to Chat',
            'on-click-action': {
              name: 'complete',
              payload: { action: 'VIEWED_ABOUT' }
            }
          }
        ]
      }
    },

    // -------------------------------------------------------------
    // Screen 10: Contact Support (Terminal)
    // -------------------------------------------------------------
    {
      id: 'CONTACT_SUPPORT',
      title: 'Contact Support',
      terminal: true,
      data: {},
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: '📞 ISYDCI Council Secretariat'
          },
          {
            type: 'TextSubheading',
            text: 'National Athlete Helpline'
          },
          {
            type: 'TextBody',
            text: 'For athlete verification, membership cards, tournament entries, or affiliation:\n\n📞 Helpline: +91 99946 27551\n📧 Email: support@isydci.org\n🌐 Portal: https://isydci.vercel.app/\n📍 Headquarters: ISYDCI Bhavan, New Delhi - 110001, India\n\nOffice Hours: Mon - Sat (9:30 AM - 6:00 PM IST)'
          },
          {
            type: 'Footer',
            label: 'Done',
            'on-click-action': {
              name: 'complete',
              payload: { action: 'CONTACT_SUPPORT_VIEWED' }
            }
          }
        ]
      }
    }
  ]
};

async function deployFlow() {
  const filePath = path.join(__dirname, '..', 'wacto', 'isydci_flow.json');
  fs.writeFileSync(filePath, JSON.stringify(flowData, null, 2), 'utf8');
  console.log('✅ Flow JSON saved to:', filePath);

  console.log('\n--- Step 1: Uploading flow.json asset to Meta Graph API ---');
  const blob = new Blob([JSON.stringify(flowData)], { type: 'application/json' });
  const formData = new FormData();
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');
  formData.append('file', blob, 'flow.json');

  const assetRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}/assets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  const assetData = await assetRes.json();
  console.log('Asset Upload Response:', assetData);

  if (assetData.validation_errors && assetData.validation_errors.length > 0) {
    console.error('❌ Validation Errors:', JSON.stringify(assetData.validation_errors, null, 2));
    process.exit(1);
  }

  console.log('\n--- Step 2: Configuring endpoint_uri ---');
  const setEndpointRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ endpoint_uri: endpoint })
  });
  console.log('Endpoint update response:', await setEndpointRes.json());

  console.log('\n--- Step 3: Publishing Flow to LIVE ---');
  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const pubData = await pubRes.json();
  console.log('Publish Response:', pubData);

  console.log('\n--- Step 4: Fetching live flow details & preview URL ---');
  const detailRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}?fields=id,name,status,categories,endpoint_uri,preview,validation_errors`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const detailData = await detailRes.json();
  console.log('\n======================================================');
  console.log('🎯 LIVE META WHATSAPP FLOW UPDATED & PUBLISHED:');
  console.log('Flow Name:', detailData.name);
  console.log('Flow ID:', detailData.id);
  console.log('Status:', detailData.status);
  console.log('Endpoint:', detailData.endpoint_uri);
  console.log('Preview URL:', detailData.preview?.preview_url);
  console.log('Expires At:', detailData.preview?.expires_at);
  console.log('======================================================\n');
}

deployFlow().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
