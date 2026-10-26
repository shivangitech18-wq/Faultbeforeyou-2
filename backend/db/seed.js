import bcrypt from 'bcryptjs';
import { db } from './database.js';

export async function seedDatabase() {
  console.log('🌱 Initializing FaultBeforeYou database seed...');

  // Clear existing demo tables
  db.exec(`
    DELETE FROM notifications;
    DELETE FROM verification_records;
    DELETE FROM incident_updates;
    DELETE FROM status_history;
    DELETE FROM incidents;
    DELETE FROM manual_passages;
    DELETE FROM equipment;
    DELETE FROM users;
  `);

  // 1. Seed Demo Users
  console.log('👤 Seeding demo users with securely hashed credentials...');
  const salt = bcrypt.genSaltSync(10);
  const users = [
    {
      username: 'viewer',
      password: 'viewer123',
      fullName: 'Victoria Viewer',
      role: 'viewer'
    },
    {
      username: 'reporter',
      password: 'reporter123',
      fullName: 'Riley Reporter',
      role: 'reporter'
    },
    {
      username: 'tech',
      password: 'tech123',
      fullName: 'Taylor Technician',
      role: 'technician'
    },
    {
      username: 'admin',
      password: 'admin123',
      fullName: 'Alex Admin (Authorized Verifier)',
      role: 'admin'
    }
  ];

  const insertUser = db.instance.prepare(`
    INSERT INTO users (username, password_hash, full_name, role)
    VALUES (?, ?, ?, ?)
  `);

  const userMap = {};
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, salt);
    const res = insertUser.run(u.username, hash, u.fullName, u.role);
    userMap[u.username] = { id: res.lastInsertRowid, ...u };
  }

  // 2. Seed Equipment
  console.log('🖥️ Seeding demonstration equipment...');
  const equipment = [
    {
      id: 'LAB-PR-01',
      name: 'Engineering Lab Color Printer',
      type: 'printer',
      location: 'Engineering Hall 204 (Commons Area)',
      status: 'available',
      modelNumber: 'Lexmark Enterprise M553dn'
    },
    {
      id: 'LAB-PJ-01',
      name: 'Classroom Ceiling Projector',
      type: 'projector',
      location: 'Science Center Auditorium A',
      status: 'available',
      modelNumber: 'Epson PowerLite Pro 4K UHD'
    },
    {
      id: 'LAB-PC-01',
      name: 'CAD Workstation Terminal',
      type: 'desktop',
      location: 'Media Lab Workstation 07',
      status: 'available',
      modelNumber: 'Dell OptiPlex 7090 Tower'
    },
    {
      id: 'LIB-SC-01',
      name: 'Reference Document Scanner',
      type: 'scanner',
      location: 'Main Library Floor 1 Reference Desk',
      status: 'available',
      modelNumber: 'Fujitsu fi-8170 Heavy-Duty Duplex'
    }
  ];

  const insertEquipment = db.instance.prepare(`
    INSERT INTO equipment (id, name, type, location, status, model_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const eq of equipment) {
    insertEquipment.run(eq.id, eq.name, eq.type, eq.location, eq.status, eq.modelNumber);
  }

  // 3. Seed Approved Manual Passages (Feature B Knowledge Base)
  console.log('📖 Seeding approved demonstration manual passages...');
  const manuals = [
    // PRINTER MANUAL
    {
      equipmentType: 'printer',
      manualName: 'Lexmark Enterprise M553 Operator Guide',
      sectionNumber: 'Sec 3.1',
      title: 'Paper Jam Clearance in Tray 1 and Feed Rollers',
      content: 'When paper jam error code 200.01 appears: 1) Open Front Door A by pulling the release latch. 2) Gently grasp the exposed edge of the jammed sheet with both hands and pull straight out along the feed path to avoid tearing. 3) Inspect Tray 1 paper guides to ensure paper stack does not exceed maximum fill line and guides are locked snug against paper. 4) Close Door A firmly until click is heard.',
      keywords: 'paper jam tray 1 feed rollers door a 200.01 stuck paper feed path',
      isUserSafe: 1
    },
    {
      equipmentType: 'printer',
      manualName: 'Lexmark Enterprise M553 Operator Guide',
      sectionNumber: 'Sec 3.2',
      title: 'High-Temperature Fuser Jam - Technician Clearance',
      content: 'CAUTION - EXTREME HEAT HAZARD: The internal fuser operates at over 200°C (392°F). If paper has accordion-folded inside the rear fuser cavity, DO NOT pull with metal tools or bare fingers. Disconnect AC power and allow 30 minutes cooling. Disassembly of fuser thumb-screws must be performed strictly by authorized technician staff.',
      keywords: 'fuser heat burn fuser jam accordion rear cover high temperature technician',
      isUserSafe: 0
    },
    {
      equipmentType: 'printer',
      manualName: 'Lexmark Enterprise M553 Operator Guide',
      sectionNumber: 'Sec 4.2',
      title: 'Toner Cartridge Status and Replacement',
      content: 'Toner low or missing messages: 1) Open right-side access door. 2) Unlatch colored lever corresponding to depleted toner (Cyan, Magenta, Yellow, Black). 3) Shake new cartridge gently 5-6 times horizontally to distribute toner evenly. 4) Slide cartridge into matched color slot until latched. Close side door.',
      keywords: 'toner cartridge low toner ink replace cartridge empty color',
      isUserSafe: 1
    },
    {
      equipmentType: 'printer',
      manualName: 'Lexmark Enterprise M553 Operator Guide',
      sectionNumber: 'Sec 5.1',
      title: 'Network Ethernet and IP Connection Troubleshooting',
      content: 'If network status indicates "Printer Offline" or unassigned IP (0.0.0.0): 1) Inspect RJ-45 Ethernet cable at rear port; verify green link LED is solid and amber activity LED is flashing. 2) On front control panel, navigate to Settings > Reports > Network Setup Page to print IP configuration. 3) Power cycle device using rear rocker switch, waiting 15 seconds before power-on.',
      keywords: 'network offline ip address ethernet cable disconnect connection status',
      isUserSafe: 1
    },
    {
      equipmentType: 'printer',
      manualName: 'Lexmark Enterprise M553 Operator Guide',
      sectionNumber: 'Sec 6.3',
      title: 'Mandatory Post-Clearing Verification Test Print',
      content: 'Before declaring printer operational after jam or component servicing, a verification print must be conducted: Navigate to Settings > Maintenance > Diagnostic Print > Quality Test Sheet. Inspect both sides for streaks, smudges, skewing, or misfeeds. A passing test requires 2 consecutive clean single-page outputs.',
      keywords: 'verification test print post-clearing quality test test sheet recovery verify',
      isUserSafe: 1
    },

    // PROJECTOR MANUAL
    {
      equipmentType: 'projector',
      manualName: 'Epson PowerLite Pro 4K User Manual',
      sectionNumber: 'Sec 2.4',
      title: 'No Signal Detected / HDMI Input Failure',
      content: 'If the projected screen displays blue "No Signal" or search indicator: 1) Verify HDMI 1 cable is firmly connected to wall plate and presenter laptop. 2) Press the "Source Search" button on projector remote or control panel. 3) On Windows laptop, press Windows Key + P and select "Duplicate". On macOS, navigate to System Settings > Displays and toggle "Mirror". 4) Ensure resolution is set to 1920x1080 or 3840x2160 @ 60Hz.',
      keywords: 'no signal hdmi input cable black screen source display projector connect',
      isUserSafe: 1
    },
    {
      equipmentType: 'projector',
      manualName: 'Epson PowerLite Pro 4K User Manual',
      sectionNumber: 'Sec 3.1',
      title: 'Air Filter Cleaning and Overheating Warning',
      content: 'When the orange TEMP warning indicator flashes: 1) Power off projector and allow cooling fan to complete shutdown cycle (2 minutes). 2) Slide open side air filter cover. 3) Remove electrostatic air filter and tap dust into waste bin. Use small soft brush if needed. 4) Reinsert filter until locked. WARNING: Do not wash filter with water or chemical solvents.',
      keywords: 'air filter overheating temp orange led heat fan shut down dust clean',
      isUserSafe: 1
    },
    {
      equipmentType: 'projector',
      manualName: 'Epson PowerLite Pro 4K User Manual',
      sectionNumber: 'Sec 4.5',
      title: 'Lamp Unit Failure and Replacement (Technician Only)',
      content: 'DANGER - HIGH PRESSURE LAMP: When the red LAMP warning light illuminates solid, lamp life has expired or arc tube has ruptured. Authorized technicians must wear safety glasses and heat-resistant gloves. Disconnect main AC breaker before removing the underside lamp compartment screw.',
      keywords: 'lamp red light burnt out bulb replacement explosion safety glass technician',
      isUserSafe: 0
    },
    {
      equipmentType: 'projector',
      manualName: 'Epson PowerLite Pro 4K User Manual',
      sectionNumber: 'Sec 5.2',
      title: 'Post-Recovery Test Pattern Verification',
      content: 'To verify projector recovery: Press "Menu" on control panel, select "Settings" > "Test Pattern" > "Color Bars". Verify sharpness across all four corners, absence of flickering, and steady green status LED.',
      keywords: 'verification test pattern color bars projector sharpness verify recovered',
      isUserSafe: 1
    },

    // DESKTOP MANUAL
    {
      equipmentType: 'desktop',
      manualName: 'Dell OptiPlex 7090 Hardware Guide',
      sectionNumber: 'Sec 1.3',
      title: 'Front Power LED Amber Diagnostic Flash Codes',
      content: 'If power LED blinks amber: 2 blinks followed by 1 blink indicates motherboard power rail failure; 2 blinks followed by 4 blinks indicates memory/RAM unseated. User action: Disconnect AC power cable, press and hold power button for 15 seconds to drain flea power, reconnect directly to known working wall outlet, and retry boot.',
      keywords: 'amber power led blinking boot diagnostic power supply no post flea power',
      isUserSafe: 1
    },
    {
      equipmentType: 'desktop',
      manualName: 'Dell OptiPlex 7090 Hardware Guide',
      sectionNumber: 'Sec 2.1',
      title: 'DisplayPort / Dual Monitor Signal Loss',
      content: 'If monitor shows "No DisplayPort Cable": 1) Ensure DisplayPort cable latch is fully clicked into workstation GPU port. 2) Verify monitor power switch is ON and set to DisplayPort input. 3) Disconnect USB-C adapter hubs if connected and test with direct DisplayPort cable.',
      keywords: 'monitor black displayport signal loss cable blank screen no video',
      isUserSafe: 1
    },
    {
      equipmentType: 'desktop',
      manualName: 'Dell OptiPlex 7090 Hardware Guide',
      sectionNumber: 'Sec 3.4',
      title: 'No Boot Device Found / Operating System Error',
      content: 'If screen displays "Alert! No bootable devices found": 1) Unplug all external USB flash drives and portable hard drives. 2) Restart computer and press F12 during Dell splash logo to enter Boot Menu. 3) Select "Diagnostics" (ePSA) to run memory and NVMe drive self-test. 4) Note any 4-digit error code.',
      keywords: 'no boot device windows crash operating system blue screen ssd drive bootable',
      isUserSafe: 1
    },
    {
      equipmentType: 'desktop',
      manualName: 'Dell OptiPlex 7090 Hardware Guide',
      sectionNumber: 'Sec 4.1',
      title: 'Desktop Recovery Verification Procedure',
      content: 'To verify desktop recovery: 1) Power on system and ensure normal boot to OS login screen within 45 seconds with solid white LED. 2) Log in and run automated network ping test to campus gateway. 3) Launch diagnostic stress test for 60 seconds with no thermal throttling.',
      keywords: 'verification desktop boot test stress test ping recovery passed',
      isUserSafe: 1
    },

    // SCANNER MANUAL
    {
      equipmentType: 'scanner',
      manualName: 'Fujitsu fi-8170 Operator Handbook',
      sectionNumber: 'Sec 2.2',
      title: 'ADF Multi-Feed Jam and Pick Roller Cleaning',
      content: 'If paper stops in automatic document feeder (ADF) with error J01/J02: 1) Pull the ADF open lever and open scanner feeder. 2) Remove jammed sheets straight forward. 3) Moisten a lint-free cloth with Cleaner F1 (or 90%+ isopropyl alcohol) and gently wipe rubber pick rollers and brake roller. 4) Close ADF firmly until latched.',
      keywords: 'scanner jam adf multi-feed pick roller brake roller feed error j01 paper stuck',
      isUserSafe: 1
    },
    {
      equipmentType: 'scanner',
      manualName: 'Fujitsu fi-8170 Operator Handbook',
      sectionNumber: 'Sec 3.1',
      title: 'USB 3.0 Communication & TWAIN Driver Reset',
      content: 'If PaperStream IP reports "Scanner is not connected": 1) Check rear USB Type-B cable is securely seated. 2) In Windows Device Manager, expand "Imaging Devices", right-click Fujitsu fi-8170 and click "Scan for hardware changes". 3) Restart PaperStream IP capture service.',
      keywords: 'scanner offline usb disconnected twain driver not found paperstream connection',
      isUserSafe: 1
    },
    {
      equipmentType: 'scanner',
      manualName: 'Fujitsu fi-8170 Operator Handbook',
      sectionNumber: 'Sec 5.0',
      title: 'Scanner Recovery Verification Scan Test',
      content: 'To verify scanner recovery: Place standard 5-page test document stack in ADF hopper. Execute duplex color scan at 300 DPI via PaperStream Capture. Verify all 5 sheets feed smoothly without double-feed alarm and image alignment is straight.',
      keywords: 'verification scan test adf test sheet duplex passed recovered',
      isUserSafe: 1
    }
  ];

  const insertManual = db.instance.prepare(`
    INSERT INTO manual_passages (equipment_type, manual_name, section_number, title, content, keywords, is_user_safe)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of manuals) {
    insertManual.run(m.equipmentType, m.manualName, m.sectionNumber, m.title, m.content, m.keywords, m.isUserSafe);
  }

  // 4. Seed 2 Historical Incidents on LAB-PR-01 and LAB-PC-01 (Feature C Grounding)
  console.log('📜 Seeding historical resolved incidents for Incident Intelligence...');
  
  // Historical Incident 1: LAB-PR-01 (Printer Jam last week)
  const inc1 = db.instance.prepare(`
    INSERT INTO incidents (
      equipment_id, reporter_id, reporter_name, description,
      category, severity, ai_summary, ai_next_step, technician_required, ai_reasoning,
      status, created_at, updated_at, resolved_at
    ) VALUES (
      'LAB-PR-01', ?, 'Riley Reporter', 'Tray 1 paper feed continuously jammed after loading 80gsm paper',
      'Hardware', 'Medium', 'Paper feed sensor obstruction in Tray 1', 'Clean Tray 1 pickup rollers and check feed tension',
      1, 'Repeated feeding jam indicates roller wear or debris in Tray 1',
      'resolved', datetime('now', '-7 days'), datetime('now', '-6 days'), datetime('now', '-6 days')
    )
  `).run(userMap.reporter.id);

  db.instance.prepare(`
    INSERT INTO incident_updates (incident_id, user_id, user_name, user_role, update_type, note, action_taken, created_at)
    VALUES (?, ?, 'Taylor Technician', 'technician', 'repair_attempt',
      'Inspected Tray 1. Cleaned rubber pickup roller with isopropyl alcohol wipe. Adjusted paper guides to Letter width.',
      'Roller cleaned and guide calibrated',
      datetime('now', '-6 days', '+2 hours')
    )
  `).run(inc1.lastInsertRowid, userMap.tech.id);

  db.instance.prepare(`
    INSERT INTO verification_records (incident_id, equipment_id, verifier_id, verifier_name, test_name, test_result, notes, created_at)
    VALUES (?, 'LAB-PR-01', ?, 'Alex Admin (Authorized Verifier)',
      'Diagnostic Quality Test Sheet (2 copies)', 'passed',
      'Printed 2 consecutive diagnostic sheets from Maintenance menu. Feed path clear, clean output.',
      datetime('now', '-6 days', '+3 hours')
    )
  `).run(inc1.lastInsertRowid, userMap.admin.id);

  db.instance.prepare(`
    INSERT INTO status_history (equipment_id, incident_id, previous_status, new_status, changed_by_id, changed_by_name, reason, created_at)
    VALUES ('LAB-PR-01', ?, 'out_of_service', 'available', ?, 'Alex Admin (Authorized Verifier)',
      'Passed verification test print: Diagnostic Quality Test Sheet',
      datetime('now', '-6 days', '+3 hours')
    )
  `).run(inc1.lastInsertRowid, userMap.admin.id);

  // Historical Incident 2: LAB-PC-01 (CAD Workstation display cable)
  const inc2 = db.instance.prepare(`
    INSERT INTO incidents (
      equipment_id, reporter_id, reporter_name, description,
      category, severity, ai_summary, ai_next_step, technician_required, ai_reasoning,
      status, created_at, updated_at, resolved_at
    ) VALUES (
      'LAB-PC-01', ?, 'Riley Reporter', 'Dual monitor not displaying signal, screen enters power saving mode',
      'Display', 'Low', 'DisplayPort cable disconnected at rear GPU bracket', 'Reseat DisplayPort cable into primary GPU output',
      0, 'Power saving mode on monitor usually points to loose video cable',
      'resolved', datetime('now', '-3 days'), datetime('now', '-2 days'), datetime('now', '-2 days')
    )
  `).run(userMap.reporter.id);

  db.instance.prepare(`
    INSERT INTO incident_updates (incident_id, user_id, user_name, user_role, update_type, note, action_taken, created_at)
    VALUES (?, ?, 'Taylor Technician', 'technician', 'repair_attempt',
      'Replaced loose DisplayPort cable with latching DP 1.4 cable. Cleaned dust from GPU exhaust port.',
      'Replaced DisplayPort cable',
      datetime('now', '-2 days', '+1 hour')
    )
  `).run(inc2.lastInsertRowid, userMap.tech.id);

  db.instance.prepare(`
    INSERT INTO verification_records (incident_id, equipment_id, verifier_id, verifier_name, test_name, test_result, notes, created_at)
    VALUES (?, 'LAB-PC-01', ?, 'Alex Admin (Authorized Verifier)',
      '60-second Dual Monitor GPU Stress & Reboot', 'passed',
      'System cleanly rebooted to Windows login. Both 4K displays responsive at 60Hz.',
      datetime('now', '-2 days', '+2 hours')
    )
  `).run(inc2.lastInsertRowid, userMap.admin.id);

  db.instance.prepare(`
    INSERT INTO status_history (equipment_id, incident_id, previous_status, new_status, changed_by_id, changed_by_name, reason, created_at)
    VALUES ('LAB-PC-01', ?, 'out_of_service', 'available', ?, 'Alex Admin (Authorized Verifier)',
      'Passed verification test: 60-second Dual Monitor GPU Stress & Reboot',
      datetime('now', '-2 days', '+2 hours')
    )
  `).run(inc2.lastInsertRowid, userMap.admin.id);

  console.log('✅ Seed completed successfully!');
  console.log(`- Users seeded: ${users.length}`);
  console.log(`- Equipment seeded: ${equipment.length}`);
  console.log(`- Manual passages seeded: ${manuals.length}`);
  console.log(`- Historical incidents seeded: 2`);
}

// Run directly when executed
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
