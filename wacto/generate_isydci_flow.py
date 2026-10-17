import json
import uuid
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

def make_id():
    return str(uuid.uuid4())

def build_flow():
    # Node IDs
    root_id = "root"
    explore_menu_id = make_id()
    reg_guide_id = make_id()
    reg_online_id = make_id()
    card_portal_id = make_id()
    tourn_info_id = make_id()
    events_id = make_id()
    roster_id = make_id()
    sports_dir_id = make_id()
    sport_overview_id = make_id()
    states_dir_id = make_id()
    state_detail_id = make_id()
    secretariat_id = make_id()

    # 1. Root Node
    root_btn_reg = make_id()
    root_btn_card = make_id()
    root_btn_explore = make_id()

    root_node = {
        "nodeId": root_id,
        "type": "interactive",
        "name": "ISYDCI Welcome & Menu",
        "interactiveId": None,
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 100, "y": 100},
        "keywords": ["hi", "hello", "hey", "isydci", "start", "menu"],
        "data": {
            "interactiveType": "button",
            "body": "🏆 *Welcome to Indian Sports Youth Development Council of India (ISYDCI)*!\n\nEmpowering Indian athletes through national championships, talent pathways, official membership & athlete accreditation.\n\n📍 Reg No: 49/1997 | New Delhi HQ\n\nHow can we assist you today?",
            "header": {"type": "text", "text": "ISYDCI Official"},
            "footer": "Official WhatsApp Portal",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": root_btn_reg, "title": "Register"}},
                    {"type": "reply", "reply": {"id": root_btn_card, "title": "Membership Card"}},
                    {"type": "reply", "reply": {"id": root_btn_explore, "title": "Explore ISYDCI"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 2. Explore Services List
    explore_rows = [
        {"id": make_id(), "title": "Tournament Info", "description": "National championship, fee & draw info"},
        {"id": make_id(), "title": "Upcoming Events", "description": "State trials, national meets & calendar"},
        {"id": make_id(), "title": "Athletes Roster", "description": "National athletes, medalists & profiles"},
        {"id": make_id(), "title": "Select Sport", "description": "Browse officially recognized sports"},
        {"id": make_id(), "title": "Select State", "description": "State & district association branches"},
        {"id": make_id(), "title": "ISYDCI Secretariat", "description": "New Delhi headquarters & official desk"},
        {"id": make_id(), "title": "Main Menu", "description": "Return to main welcome greeting"}
    ]
    explore_node = {
        "nodeId": explore_menu_id,
        "type": "interactive",
        "name": "ISYDCI Services Menu",
        "interactiveId": root_btn_explore,
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 400, "y": 300},
        "keywords": ["Explore ISYDCI"],
        "data": {
            "interactiveType": "list",
            "body": "🏅 *ISYDCI Official Services & Information*\n\nPlease select any department or service below to proceed:",
            "header": {"type": "none", "text": ""},
            "footer": "Select an option from list",
            "action": {
                "button": "View Services",
                "sections": [
                    {
                        "title": "Championships & Events",
                        "rows": explore_rows[:2]
                    },
                    {
                        "title": "Athletes & Services",
                        "rows": explore_rows[2:]
                    }
                ],
                "dynamicRows": {"enabled": False}
            }
        }
    }

    # 3. Athlete Registration Guide
    reg_btn_sport = make_id()
    reg_btn_online = make_id()
    reg_btn_menu = make_id()
    reg_guide_node = {
        "nodeId": reg_guide_id,
        "type": "interactive",
        "name": "Athlete Registration Guide",
        "interactiveId": root_btn_reg,
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 400, "y": -150},
        "keywords": ["Register"],
        "data": {
            "interactiveType": "button",
            "body": "📝 *ISYDCI Athlete Registration*\n\nJoin the official national sports registry:\n\n1️⃣ Official Athlete Identity & Card\n2️⃣ Eligibility for National Championships\n3️⃣ Scholarship & Talent Identification Pathways\n\nTo complete registration with photo & sports profile:",
            "header": {"type": "text", "text": "Athlete Registration"},
            "footer": "ISYDCI Membership",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": reg_btn_sport, "title": "Select Sport"}},
                    {"type": "reply", "reply": {"id": reg_btn_online, "title": "Register Online"}},
                    {"type": "reply", "reply": {"id": reg_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 4. Register Online Portal Link
    online_btn_verify = make_id()
    online_btn_menu = make_id()
    reg_online_node = {
        "nodeId": reg_online_id,
        "type": "interactive",
        "name": "Online Registration Portal",
        "interactiveId": reg_btn_online,
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 750, "y": -150},
        "keywords": ["Register Online"],
        "data": {
            "interactiveType": "button",
            "body": "🌐 *Online Membership Registration*\n\nYou can register directly on our official web portal:\n\n👉 https://isydci.vercel.app/membership-card\n\nUpload your profile photo, sports discipline, age, and state to receive your verified digital athlete card.\n\nAlready registered? Tap 'Verify Membership' below.",
            "header": {"type": "text", "text": "Web Registration"},
            "footer": "isydci.vercel.app",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": online_btn_verify, "title": "Verify Membership"}},
                    {"type": "reply", "reply": {"id": online_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 5. Membership Card Portal
    card_btn_verify = make_id()
    card_btn_dl = make_id()
    card_btn_menu = make_id()
    card_portal_node = {
        "nodeId": card_portal_id,
        "type": "interactive",
        "name": "Membership Card Portal",
        "interactiveId": root_btn_card,
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 400, "y": 80},
        "keywords": ["Membership Card"],
        "data": {
            "interactiveType": "button",
            "body": "🪪 *ISYDCI Athlete ID Card Portal*\n\nYour digital membership card provides verified proof of accreditation for all sanctioned meets.\n\n• Existing Athletes: Tap 'Verify Membership' or type your Member ID (e.g. ISYDCI-684DDC04).\n• Download: Tap 'Download ID Card' to receive your card directly on WhatsApp.\n• New Athletes: Register online.",
            "header": {"type": "text", "text": "Digital ID Card"},
            "footer": "Official Athlete Verification",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": card_btn_verify, "title": "Verify Membership"}},
                    {"type": "reply", "reply": {"id": card_btn_dl, "title": "Download ID Card"}},
                    {"type": "reply", "reply": {"id": card_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 6. Tournament Info
    tourn_btn_utr = make_id()
    tourn_btn_draw = make_id()
    tourn_btn_menu = make_id()
    tourn_info_node = {
        "nodeId": tourn_info_id,
        "type": "interactive",
        "name": "National Championship Info",
        "interactiveId": explore_rows[0]["id"],
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 750, "y": 80},
        "keywords": ["Tournament Info"],
        "data": {
            "interactiveType": "button",
            "body": "🏆 *ISYDCI National Championship*\n\n• Entry Fee: ₹2,000 per athlete\n• Official Payment: UPI / QR Code\n• Draw Number: Issued upon UTR confirmation\n\nSteps to finalize your entry:\n1. Pay entry fee via UPI QR\n2. Note your 12-digit UTR reference\n3. Tap 'Submit UTR' or send screenshot\n4. Tap 'Check Draw Number' for your draw status",
            "header": {"type": "text", "text": "National Tournament"},
            "footer": "₹2,000 Entry Fee",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": tourn_btn_utr, "title": "Submit UTR"}},
                    {"type": "reply", "reply": {"id": tourn_btn_draw, "title": "Check Draw Number"}},
                    {"type": "reply", "reply": {"id": tourn_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 7. Upcoming Events
    events_btn_roster = make_id()
    events_btn_tourn = make_id()
    events_btn_menu = make_id()
    events_node = {
        "nodeId": events_id,
        "type": "interactive",
        "name": "Upcoming Events & Trials",
        "interactiveId": explore_rows[1]["id"],
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 750, "y": 280},
        "keywords": ["Upcoming Events"],
        "data": {
            "interactiveType": "button",
            "body": "📅 *Upcoming Events & National Calendar*\n\n1. National Youth Athletics Meet — Delhi\n2. State Selection Trials — Tamil Nadu, Karnataka & Maharashtra\n3. National Inter-Club Badminton Championship\n4. Youth Boxing Talent Camp\n\nFor fixture updates and draw notifications, keep your membership active.",
            "header": {"type": "text", "text": "Events Calendar"},
            "footer": "National Schedule",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": events_btn_roster, "title": "Athletes Roster"}},
                    {"type": "reply", "reply": {"id": events_btn_tourn, "title": "Tournament Info"}},
                    {"type": "reply", "reply": {"id": events_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 8. Athletes Roster
    roster_btn_reg = make_id()
    roster_btn_sport = make_id()
    roster_btn_menu = make_id()
    roster_node = {
        "nodeId": roster_id,
        "type": "interactive",
        "name": "Featured Athletes Roster",
        "interactiveId": explore_rows[2]["id"],
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 750, "y": 480},
        "keywords": ["Athletes Roster"],
        "data": {
            "interactiveType": "button",
            "body": "🥇 *ISYDCI National Athletes Roster*\n\nOver 200+ elite athletes accredited across India in track & field, combat sports, racquet sports, and team games.\n\nView full roster & medal hall of fame:\n👉 https://isydci.vercel.app/athletes\n\nAre you ready to represent your state?",
            "header": {"type": "text", "text": "Athletes Roster"},
            "footer": "isydci.vercel.app/athletes",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": roster_btn_reg, "title": "Register"}},
                    {"type": "reply", "reply": {"id": roster_btn_sport, "title": "Select Sport"}},
                    {"type": "reply", "reply": {"id": roster_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 9. Sports Directory
    sports_rows = [
        {"id": make_id(), "title": "Athletics & Track", "description": "Sprints, jumps, hurdles & field"},
        {"id": make_id(), "title": "Badminton", "description": "Singles, doubles & junior circuit"},
        {"id": make_id(), "title": "Boxing", "description": "Weight category state & national bouts"},
        {"id": make_id(), "title": "Football", "description": "Youth clubs & inter-district leagues"},
        {"id": make_id(), "title": "Swimming", "description": "Freestyle, stroke & relay trials"},
        {"id": make_id(), "title": "Kabaddi", "description": "Pro style & circle kabaddi tournaments"},
        {"id": make_id(), "title": "Volleyball", "description": "Spikers & inter-state cups"},
        {"id": make_id(), "title": "Weightlifting", "description": "Snatch, clean & jerk national rankings"},
        {"id": make_id(), "title": "Wrestling", "description": "Freestyle & Greco-Roman divisions"},
        {"id": make_id(), "title": "Sport Guidelines", "description": "Official rules, age groups & criteria"}
    ]
    sports_dir_node = {
        "nodeId": sports_dir_id,
        "type": "interactive",
        "name": "Sports Directory",
        "interactiveId": explore_rows[3]["id"],
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 750, "y": 700},
        "keywords": ["Select Sport"],
        "data": {
            "interactiveType": "list",
            "body": "🎯 *ISYDCI Recognized Sports Disciplines*\n\nSelect a sport discipline below to view accreditation guidelines and state trial criteria:",
            "header": {"type": "none", "text": ""},
            "footer": "Choose your discipline",
            "action": {
                "button": "Choose Sport",
                "sections": [
                    {
                        "title": "Olympic Disciplines",
                        "rows": sports_rows[:5]
                    },
                    {
                        "title": "Traditional & Combat",
                        "rows": sports_rows[5:]
                    }
                ],
                "dynamicRows": {"enabled": False}
            }
        }
    }

    # 10. Sport Category Overview
    sport_btn_reg = make_id()
    sport_btn_state = make_id()
    sport_btn_menu = make_id()
    sport_overview_node = {
        "nodeId": sport_overview_id,
        "type": "interactive",
        "name": "Sport Category Overview",
        "interactiveId": sports_rows[0]["id"],
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 1100, "y": 700},
        "keywords": ["Athletics & Track"],
        "data": {
            "interactiveType": "button",
            "body": "🏅 *Sport Discipline Accreditation*\n\nISYDCI coordinates with state sports bodies to organize state trials, referee certification, and national tournament seedings for this discipline.\n\nReady to register for this sport?",
            "header": {"type": "text", "text": "Sports Discipline"},
            "footer": "National Accreditation",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": sport_btn_reg, "title": "Register"}},
                    {"type": "reply", "reply": {"id": sport_btn_state, "title": "Select State"}},
                    {"type": "reply", "reply": {"id": sport_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 11. State Associations Directory
    state_rows = [
        {"id": make_id(), "title": "Tamil Nadu State", "description": "Chennai, Madurai, Coimbatore & districts"},
        {"id": make_id(), "title": "Karnataka State", "description": "Bengaluru, Mysuru, Hubballi & chapters"},
        {"id": make_id(), "title": "Kerala State", "description": "Kochi, Thiruvananthapuram & academies"},
        {"id": make_id(), "title": "Andhra Pradesh", "description": "Visakhapatnam, Vijayawada & zones"},
        {"id": make_id(), "title": "Telangana State", "description": "Hyderabad, Warangal & sports bodies"},
        {"id": make_id(), "title": "Delhi Capital", "description": "NCR, New Delhi & central trials"},
        {"id": make_id(), "title": "Maharashtra State", "description": "Mumbai, Pune, Nagpur & districts"},
        {"id": make_id(), "title": "Uttar Pradesh", "description": "Lucknow, Kanpur, Varanasi & centers"},
        {"id": make_id(), "title": "Punjab State", "description": "Ludhiana, Jalandhar, Amritsar & camps"},
        {"id": make_id(), "title": "All Other States", "description": "Direct national secretariat accreditation"}
    ]
    states_dir_node = {
        "nodeId": states_dir_id,
        "type": "interactive",
        "name": "State Associations",
        "interactiveId": explore_rows[4]["id"],
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 750, "y": 950},
        "keywords": ["Select State"],
        "data": {
            "interactiveType": "list",
            "body": "📍 *ISYDCI State & Zone Chapters*\n\nSelect your state or regional chapter for local trial dates and coordinator contact:",
            "header": {"type": "none", "text": ""},
            "footer": "Select your state",
            "action": {
                "button": "Choose State",
                "sections": [
                    {
                        "title": "South Zone",
                        "rows": state_rows[:5]
                    },
                    {
                        "title": "North & Central",
                        "rows": state_rows[5:]
                    }
                ],
                "dynamicRows": {"enabled": False}
            }
        }
    }

    # 12. State Chapter Details
    state_btn_reg = make_id()
    state_btn_sec = make_id()
    state_btn_menu = make_id()
    state_detail_node = {
        "nodeId": state_detail_id,
        "type": "interactive",
        "name": "State Chapter Details",
        "interactiveId": state_rows[0]["id"],
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 1100, "y": 950},
        "keywords": ["Tamil Nadu State"],
        "data": {
            "interactiveType": "button",
            "body": "🏛️ *State Chapter & Trials Information*\n\nState trials are conducted bi-annually. All registered ISYDCI members are eligible to attend trials for state team selection.\n\nNeed direct assistance from state coordinators?",
            "header": {"type": "text", "text": "State Association"},
            "footer": "ISYDCI State Chapter",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": state_btn_reg, "title": "Register"}},
                    {"type": "reply", "reply": {"id": state_btn_sec, "title": "ISYDCI Secretariat"}},
                    {"type": "reply", "reply": {"id": state_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # 13. ISYDCI Secretariat Info
    sec_btn_supp = make_id()
    sec_btn_reg = make_id()
    sec_btn_menu = make_id()
    secretariat_node = {
        "nodeId": secretariat_id,
        "type": "interactive",
        "name": "ISYDCI Secretariat Info",
        "interactiveId": explore_rows[5]["id"],
        "assignedAgent": None,
        "assignedAgents": [],
        "enabledNotify": False,
        "notifyConfig": {},
        "funnelStageConfig": {"enabled": False},
        "variableConfig": {},
        "canvasPosition": {"x": 750, "y": 1200},
        "keywords": ["ISYDCI Secretariat"],
        "data": {
            "interactiveType": "button",
            "body": "🏛️ *National Secretariat Desk*\n\nInternational Sports & Youth Development Campaign / Indian Sports Youth Development Council of India\n\n📍 Address: VB Bhavan, Room No. 308, Rafi Marg, Sansad Marg, New Delhi – 110001\n📜 Reg No: 49/1997\n🌐 Web: https://isydci.vercel.app\n\nNeed immediate support?",
            "header": {"type": "text", "text": "HQ Secretariat"},
            "footer": "New Delhi Central Office",
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": sec_btn_supp, "title": "Contact Support"}},
                    {"type": "reply", "reply": {"id": sec_btn_reg, "title": "Register"}},
                    {"type": "reply", "reply": {"id": sec_btn_menu, "title": "Main Menu"}}
                ],
                "sections": [],
                "button": ""
            }
        }
    }

    # Collect Nodes
    nodes = [
        root_node,
        explore_node,
        reg_guide_node,
        reg_online_node,
        card_portal_node,
        tourn_info_node,
        events_node,
        roster_node,
        sports_dir_node,
        sport_overview_node,
        states_dir_node,
        state_detail_node,
        secretariat_node
    ]

    # EDGES
    # Crucial rule: Every keyword must have exactly 1 destination across the flow!
    # No backend_only options can have an edge!
    edges = [
        # From Root
        {"id": make_id(), "fromNodeId": root_id, "toNodeId": reg_guide_id, "keywords": ["Register"], "intentName": "Register", "delay": 0},
        {"id": make_id(), "fromNodeId": root_id, "toNodeId": card_portal_id, "keywords": ["Membership Card"], "intentName": "Membership Card", "delay": 0},
        {"id": make_id(), "fromNodeId": root_id, "toNodeId": explore_menu_id, "keywords": ["Explore ISYDCI"], "intentName": "Explore ISYDCI", "delay": 0},

        # From Explore Services Menu
        {"id": make_id(), "fromNodeId": explore_menu_id, "toNodeId": tourn_info_id, "keywords": ["Tournament Info"], "intentName": "Tournament Info", "delay": 0},
        {"id": make_id(), "fromNodeId": explore_menu_id, "toNodeId": events_id, "keywords": ["Upcoming Events"], "intentName": "Upcoming Events", "delay": 0},
        {"id": make_id(), "fromNodeId": explore_menu_id, "toNodeId": roster_id, "keywords": ["Athletes Roster"], "intentName": "Athletes Roster", "delay": 0},
        {"id": make_id(), "fromNodeId": explore_menu_id, "toNodeId": sports_dir_id, "keywords": ["Select Sport"], "intentName": "Select Sport", "delay": 0},
        {"id": make_id(), "fromNodeId": explore_menu_id, "toNodeId": states_dir_id, "keywords": ["Select State"], "intentName": "Select State", "delay": 0},
        {"id": make_id(), "fromNodeId": explore_menu_id, "toNodeId": secretariat_id, "keywords": ["ISYDCI Secretariat"], "intentName": "ISYDCI Secretariat", "delay": 0},
        {"id": make_id(), "fromNodeId": explore_menu_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From Athlete Registration Guide
        {"id": make_id(), "fromNodeId": reg_guide_id, "toNodeId": sports_dir_id, "keywords": ["Select Sport"], "intentName": "Select Sport", "delay": 0},
        {"id": make_id(), "fromNodeId": reg_guide_id, "toNodeId": reg_online_id, "keywords": ["Register Online"], "intentName": "Register Online", "delay": 0},
        {"id": make_id(), "fromNodeId": reg_guide_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From Online Registration Portal
        # (online_btn_verify is "Verify Membership" -> backend_only, NO EDGE!)
        {"id": make_id(), "fromNodeId": reg_online_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From Membership Card Portal
        # (card_btn_verify is "Verify Membership" -> backend_only, NO EDGE!)
        # (card_btn_dl is "Download ID Card" -> backend_only, NO EDGE!)
        {"id": make_id(), "fromNodeId": card_portal_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From National Championship Info
        # (tourn_btn_utr is "Submit UTR" -> backend_only, NO EDGE!)
        # (tourn_btn_draw is "Check Draw Number" -> backend_only, NO EDGE!)
        {"id": make_id(), "fromNodeId": tourn_info_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From Upcoming Events & Trials
        {"id": make_id(), "fromNodeId": events_id, "toNodeId": roster_id, "keywords": ["Athletes Roster"], "intentName": "Athletes Roster", "delay": 0},
        {"id": make_id(), "fromNodeId": events_id, "toNodeId": tourn_info_id, "keywords": ["Tournament Info"], "intentName": "Tournament Info", "delay": 0},
        {"id": make_id(), "fromNodeId": events_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From Featured Athletes Roster
        {"id": make_id(), "fromNodeId": roster_id, "toNodeId": reg_guide_id, "keywords": ["Register"], "intentName": "Register", "delay": 0},
        {"id": make_id(), "fromNodeId": roster_id, "toNodeId": sports_dir_id, "keywords": ["Select Sport"], "intentName": "Select Sport", "delay": 0},
        {"id": make_id(), "fromNodeId": roster_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From Sport Category Overview
        {"id": make_id(), "fromNodeId": sport_overview_id, "toNodeId": reg_guide_id, "keywords": ["Register"], "intentName": "Register", "delay": 0},
        {"id": make_id(), "fromNodeId": sport_overview_id, "toNodeId": states_dir_id, "keywords": ["Select State"], "intentName": "Select State", "delay": 0},
        {"id": make_id(), "fromNodeId": sport_overview_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From State Chapter Details
        {"id": make_id(), "fromNodeId": state_detail_id, "toNodeId": reg_guide_id, "keywords": ["Register"], "intentName": "Register", "delay": 0},
        {"id": make_id(), "fromNodeId": state_detail_id, "toNodeId": secretariat_id, "keywords": ["ISYDCI Secretariat"], "intentName": "ISYDCI Secretariat", "delay": 0},
        {"id": make_id(), "fromNodeId": state_detail_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},

        # From ISYDCI Secretariat Info
        # (sec_btn_supp is "Contact Support" -> backend_only, NO EDGE!)
        {"id": make_id(), "fromNodeId": secretariat_id, "toNodeId": reg_guide_id, "keywords": ["Register"], "intentName": "Register", "delay": 0},
        {"id": make_id(), "fromNodeId": secretariat_id, "toNodeId": root_id, "keywords": ["Main Menu"], "intentName": "Main Menu", "delay": 0},
    ]

    # Add edges for all sports rows to sport_overview_id
    for s_row in sports_rows:
        edges.append({
            "id": make_id(),
            "fromNodeId": sports_dir_id,
            "toNodeId": sport_overview_id,
            "keywords": [s_row["title"]],
            "intentName": s_row["title"],
            "delay": 0
        })

    # Add edges for all state rows to state_detail_id
    for st_row in state_rows:
        edges.append({
            "id": make_id(),
            "fromNodeId": states_dir_id,
            "toNodeId": state_detail_id,
            "keywords": [st_row["title"]],
            "intentName": st_row["title"],
            "delay": 0
        })

    chatbot_doc = {
        "chatbot": {
            "name": "ISYDCI-Official-Bot-v1",
            "description": "Indian Sports Youth Development Council of India WhatsApp Flow"
        },
        "manualResolution": False,
        "nodes": nodes,
        "edges": edges
    }

    out_path = Path(r"c:\Users\Admin\OneDrive\Desktop\New folder (2)\isdyci-main\wacto\isydci_flow_v1.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(chatbot_doc, f, indent=2, ensure_ascii=False)

    print(f"✅ Generated flow at {out_path}")
    print(f"Total Nodes: {len(nodes)}, Total Edges: {len(edges)}")

if __name__ == "__main__":
    build_flow()
