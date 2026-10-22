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
const flowId = '1144332054698029';

const flowJson = {
  version: '6.0',
  routing_model: {
    ATHLETE_REGISTRATION: ['REG_SUCCESS'],
    REG_SUCCESS: []
  },
  screens: [
    {
      id: 'ATHLETE_REGISTRATION',
      title: 'Athlete Registration',
      terminal: false,
      data: {},
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: '🏅 Athlete Registration'
          },
          {
            type: 'TextSubheading',
            text: 'Indian Sports Youth Development Council'
          },
          {
            type: 'TextCaption',
            text: 'Govt Reg No: 49/1997 | National Secretariat'
          },
          {
            type: 'Form',
            name: 'athlete_form',
            children: [
              {
                type: 'TextInput',
                name: 'full_name',
                label: 'Full Name (as per Govt ID)',
                required: true
              },
              {
                type: 'TextInput',
                name: 'contact_number',
                label: 'Mobile / WhatsApp Number',
                'input-type': 'phone',
                required: true
              },
              {
                type: 'Dropdown',
                name: 'state',
                label: 'State / UT',
                required: true,
                'data-source': [
                  { id: 'Tamil Nadu', title: 'Tamil Nadu' },
                  { id: 'Delhi', title: 'Delhi (HQ Chapter)' },
                  { id: 'Karnataka', title: 'Karnataka' },
                  { id: 'Kerala', title: 'Kerala' },
                  { id: 'Maharashtra', title: 'Maharashtra' },
                  { id: 'Uttar Pradesh', title: 'Uttar Pradesh' },
                  { id: 'Punjab', title: 'Punjab' },
                  { id: 'Haryana', title: 'Haryana' },
                  { id: 'Andhra Pradesh', title: 'Andhra Pradesh' },
                  { id: 'Telangana', title: 'Telangana' },
                  { id: 'Gujarat', title: 'Gujarat' },
                  { id: 'Rajasthan', title: 'Rajasthan' },
                  { id: 'West Bengal', title: 'West Bengal' },
                  { id: 'Other', title: 'Other State / UT' }
                ]
              },
              {
                type: 'TextInput',
                name: 'district',
                label: 'District',
                required: true
              },
              {
                type: 'TextInput',
                name: 'assembly',
                label: 'Assembly Constituency',
                required: false
              },
              {
                type: 'TextInput',
                name: 'zone',
                label: 'Zone / Ward',
                required: false
              },
              {
                type: 'DatePicker',
                name: 'dob',
                label: 'Date of Birth',
                required: true
              },
              {
                type: 'Dropdown',
                name: 'blood_group',
                label: 'Blood Group',
                required: true,
                'data-source': [
                  { id: 'O+', title: 'O+' },
                  { id: 'A+', title: 'A+' },
                  { id: 'B+', title: 'B+' },
                  { id: 'AB+', title: 'AB+' },
                  { id: 'O-', title: 'O-' },
                  { id: 'A-', title: 'A-' },
                  { id: 'B-', title: 'B-' },
                  { id: 'AB-', title: 'AB-' }
                ]
              },
              {
                type: 'TextArea',
                name: 'address',
                label: 'Permanent Address',
                required: true
              },
              {
                type: 'CheckboxGroup',
                name: 'confirm_declaration',
                label: 'Declaration',
                required: true,
                'data-source': [
                  { id: 'agreed', title: 'I declare that all entered information is correct' }
                ]
              },
              {
                type: 'Footer',
                label: 'Submit Registration',
                'on-click-action': {
                  name: 'navigate',
                  next: {
                    type: 'screen',
                    name: 'REG_SUCCESS'
                  },
                  payload: {
                    full_name: '${form.full_name}',
                    contact_number: '${form.contact_number}',
                    state: '${form.state}',
                    district: '${form.district}',
                    assembly: '${form.assembly}',
                    zone: '${form.zone}',
                    dob: '${form.dob}',
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
    {
      id: 'REG_SUCCESS',
      title: 'Registration Successful',
      terminal: true,
      data: {
        full_name: { type: 'string', __example__: 'Amit Kumar' },
        contact_number: { type: 'string', __example__: '+919994627551' },
        state: { type: 'string', __example__: 'Tamil Nadu' },
        district: { type: 'string', __example__: 'Coimbatore' },
        assembly: { type: 'string', __example__: 'Singanallur' },
        zone: { type: 'string', __example__: 'South Zone' },
        dob: { type: 'string', __example__: '2000-01-01' },
        blood_group: { type: 'string', __example__: 'O+' },
        address: { type: 'string', __example__: '123 Main Street' }
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: '🎉 Registration Complete!'
          },
          {
            type: 'TextSubheading',
            text: 'Indian Sports Youth Development Council'
          },
          {
            type: 'TextBody',
            text: 'Thank you for registering with ISYDCI (Reg No: 49/1997).\n\nYour application has been received. Our council officials will review your submission and issue your official Front & Back Digital ID card.\n\nHelpline: +91 99946 27551\nWebsite: https://isydci.vercel.app/'
          },
          {
            type: 'Footer',
            label: 'Done',
            'on-click-action': {
              name: 'complete',
              payload: {
                full_name: '${data.full_name}',
                contact_number: '${data.contact_number}',
                state: '${data.state}',
                district: '${data.district}',
                assembly: '${data.assembly}',
                zone: '${data.zone}',
                dob: '${data.dob}',
                blood_group: '${data.blood_group}',
                address: '${data.address}'
              }
            }
          }
        ]
      }
    }
  ]
};

async function deploy() {
  console.log('--- Step 1: Uploading flow asset to Flow ID:', flowId);
  const blob = new Blob([JSON.stringify(flowJson)], { type: 'application/json' });
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
  console.log('Upload Result:', JSON.stringify(assetData, null, 2));

  if (assetData.validation_errors && assetData.validation_errors.length > 0) {
    console.error('Validation errors found, stopping.');
    return;
  }

  console.log('\n--- Step 2: Publishing flow to LIVE ---');
  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const pubData = await pubRes.json();
  console.log('Publish Result:', JSON.stringify(pubData, null, 2));

  console.log('\n--- Step 3: Fetching Flow Details ---');
  const detRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}?fields=id,name,status,categories,preview`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const detData = await detRes.json();
  console.log('Flow Details:', JSON.stringify(detData, null, 2));
}

deploy().catch(console.error);
