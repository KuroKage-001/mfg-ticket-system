import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Category seed data
// ---------------------------------------------------------------------------

const CATEGORIES: { name: string; sortOrder: number }[] = [
  // Biz Apps and Analytics
  { name: "Biz Apps and Analytics >> ADP IS QlikView Reports", sortOrder: 100 },
  { name: "Biz Apps and Analytics >> LTS (Lot Tracking System)", sortOrder: 101 },
  { name: "Biz Apps and Analytics >> eRoute Version 1 / Workflow Issues", sortOrder: 102 },
  { name: "Biz Apps and Analytics >> eRoute Workflow (GenericWorkflow)", sortOrder: 103 },
  // DCC
  { name: "DCC>> Account Request", sortOrder: 200 },
  { name: "DCC>> Change System Config (configure to ETS, LTX, etc.)", sortOrder: 201 },
  { name: "DCC>> Check Unsaved Map", sortOrder: 202 },
  { name: "DCC>> DCC IP Configuration", sortOrder: 203 },
  { name: "DCC>> DCC Installation", sortOrder: 204 },
  { name: "DCC>> Enable/Disable Bin Retest", sortOrder: 205 },
  { name: "DCC>> Enable/Disable Bin Yield, Site Yield, Consecutive Fail Alarm", sortOrder: 206 },
  { name: "DCC>> Enable/Disable FAM Setting", sortOrder: 207 },
  { name: "DCC>> Enable/Disable TouchDown Count", sortOrder: 208 },
  { name: "DCC>> Enroll device and add TDS map merge recipe for auto import", sortOrder: 209 },
  { name: "DCC>> Manual Map Upload", sortOrder: 210 },
  { name: "DCC>> OTHERS", sortOrder: 211 },
  { name: "DCC>> Request for DCC Lot Split", sortOrder: 212 },
  { name: "DCC>> Update GDPW Checker", sortOrder: 213 },
  // ETS Issue
  { name: "ETS Issue >> OpCenter - Delayed Summary", sortOrder: 300 },
  { name: "ETS Issue >> OpCenter - ETS No Summary", sortOrder: 301 },
  { name: "ETS Issue >> OpCenter - Quantity Mismatch", sortOrder: 302 },
  // Engineering Systems
  { name: "Engineering Systems >> PDR Generator", sortOrder: 400 },
  { name: "Engineering Systems >> XML Generator", sortOrder: 401 },
  // External MFG Applications
  { name: "External MFG Applications >> Build Release, External Die Bank & Wafer Bank", sortOrder: 500 },
  { name: "External MFG Applications >> E20pen", sortOrder: 501 },
  { name: "External MFG Applications >> EWR & ORG", sortOrder: 502 },
  { name: "External MFG Applications >> Foundry & SNC", sortOrder: 503 },
  { name: "External MFG Applications >> QMS & 3 Way Match", sortOrder: 504 },
  { name: "External MFG Applications >> WIP & INV", sortOrder: 505 },
  // IGS
  { name: "IGS>> ADLK Map creation", sortOrder: 600 },
  { name: "IGS >> ADWL Map creation", sortOrder: 601 },
  { name: "IGS>> CAMAS Map creation", sortOrder: 602 },
  { name: "IGS>> Cannot find lot in IGS", sortOrder: 603 },
  { name: "IGS >> Fab stepper map update", sortOrder: 604 },
  { name: "IGS >> GDPW Update", sortOrder: 605 },
  { name: "IGS>> MMIO Access", sortOrder: 606 },
  { name: "IGS>> Map Delete", sortOrder: 607 },
  { name: "IGS >> Map Download Access", sortOrder: 608 },
  { name: "IGS >> Ptolemy wafer mapper issue", sortOrder: 609 },
  { name: "IGS>> SOR Gate unlock - Temporary", sortOrder: 610 },
  { name: "IGS>> TSMC Map creation", sortOrder: 611 },
  { name: "IGS >> Ultratech map creation", sortOrder: 612 },
  { name: "IGS >> VANGUARD Map creation", sortOrder: 613 },
  // INTEGRATOR
  { name: "INTEGRATOR >> Bin Code Assignments", sortOrder: 700 },
  { name: "INTEGRATOR >> Change System Config (configure to P8, PLUM5, etc.)", sortOrder: 701 },
  { name: "INTEGRATOR >> Check Unsaved Map", sortOrder: 702 },
  { name: "INTEGRATOR >> Enable/Disable Autofill UI", sortOrder: 703 },
  { name: "INTEGRATOR >> Enable/Disable Bin Retest", sortOrder: 704 },
  { name: "INTEGRATOR >> Enable/Disable Bin Yield, Site Yield, Consecutive Fail Alarm", sortOrder: 705 },
  { name: "INTEGRATOR >> Enable/Disable TouchDown Count", sortOrder: 706 },
  { name: "INTEGRATOR >> INT IP Configuration", sortOrder: 707 },
  { name: "INTEGRATOR >> Integrator Installation", sortOrder: 708 },
  { name: "INTEGRATOR>> Manual Map Upload", sortOrder: 709 },
  { name: "INTEGRATOR >> Map transfer", sortOrder: 710 },
  { name: "INTEGRATOR >> OTHERS", sortOrder: 711 },
  { name: "INTEGRATOR >> Update GDPW Checker", sortOrder: 712 },
  // IRAC
  { name: "IRAC >> Delete Invalid Hold", sortOrder: 800 },
  { name: "IRAC >> MANUAL RELEASE", sortOrder: 801 },
  // MFG APPS
  { name: "MFG APPS >> PECN ACCESS MANAGEMENT/CATEGORY/APPROVER", sortOrder: 900 },
  { name: "MFG Application Server >> XYMON Critical Alert", sortOrder: 901 },
  // MFG Applications
  { name: "MFG Applications >> AIRRS website content or access issue", sortOrder: 1000 },
  { name: "MFG Applications >> Equipment Track\\Statusphere not updated", sortOrder: 1001 },
  { name: "MFG Applications >> Extract RTY data", sortOrder: 1002 },
  { name: "MFG Applications > FGList Login / Enrollment", sortOrder: 1003 },
  { name: "MFG Applications >> FHMS website content or access issue", sortOrder: 1004 },
  { name: "MFG Applications >> Failure Verification", sortOrder: 1005 },
  { name: "MFG Applications >> GSR / ADGT Subcon Receiving", sortOrder: 1006 },
  { name: "MFG Applications >> HCR Inventory Installation", sortOrder: 1007 },
  { name: "MFG Applications >> HCR Inventory User enrollment", sortOrder: 1008 },
  { name: "MFG Applications >> HCR RRF Form Focus Group Update", sortOrder: 1009 },
  { name: "MFG Applications >> HMS Engineering", sortOrder: 1010 },
  { name: "MFG Applications >> HMS GT MFG", sortOrder: 1011 },
  { name: "MFG Applications >> IQA Barcode System", sortOrder: 1012 },
  { name: "MFG Applications >> IQA Receiving System", sortOrder: 1013 },
  { name: "MFG Applications >> IRAC- Others", sortOrder: 1014 },
  { name: "MFG Applications >> IRAC- Report", sortOrder: 1015 },
  { name: "MFG Applications >> IRAC- Service Request for new account", sortOrder: 1016 },
  { name: "MFG Applications >> IRAC- Update data", sortOrder: 1017 },
  { name: "MFG Applications >> IRAC-Missing data", sortOrder: 1018 },
  { name: "MFG Applications >> MDS", sortOrder: 1019 },
  { name: "MFG Applications >> Manufacturing Reports", sortOrder: 1020 },
  { name: "MFG Applications >> OWLS PROBE", sortOrder: 1021 },
  { name: "MFG Applications >> OWLS Tbank", sortOrder: 1022 },
  { name: "MFG Applications >> Other - All other unlisted service.", sortOrder: 1023 },
  { name: "MFG Applications >> PST (Probe Scheduling Tools)", sortOrder: 1024 },
  { name: "MFG Applications >> U2 - Add equipment (tester, prober, handler)", sortOrder: 1025 },
  { name: "MFG Applications >> U2 - Others", sortOrder: 1026 },
  { name: "MFG Applications >> U2 - Recipe management (null values, wrong program, wrong test option)", sortOrder: 1027 },
  { name: "MFG Applications >> Unified Barcode System -Print alignment issue", sortOrder: 1028 },
  { name: "MFG Applications >> eQuals Worklist issue", sortOrder: 1029 },
  // MFG Data Apps
  { name: "MFG Data Apps > ACE PAT: Feature Request >> (keywords: ACE PAT, PAT)", sortOrder: 1100 },
  { name: "MFG Data Apps> ACE PAT: Other >> (keywords: ACE PAT, PAT)", sortOrder: 1101 },
  { name: "MFG Data Apps>> ACE PAT: System Down >> (keywords: ACE PAT, PAT)", sortOrder: 1102 },
  { name: "MFG Data Apps>> ACE SBL/SYL: Feature Request >> (keywords: ACE SBL/SYL, Statistical Yield Limit, Statistical Bin Limit)", sortOrder: 1103 },
  { name: "MFG Data Apps> ACE SBL/SYL: Other>> (keywords: ACE SBL/SYL, Statistical Yield Limit, Statistical Bin Limit)", sortOrder: 1104 },
  { name: "MFG Data Apps>> ACE SBL/SYL: Request New Data Feed >> (keywords: ACE SBL/SYL, Statistical Yield Limit, Statistical Bin Limit)", sortOrder: 1105 },
  { name: "MFG Data Apps >> ACE SBL/SYL: System Down >> (keywords: ACE SBL/SYL, Statistical Yield Limit, Statistical Bin Limit)", sortOrder: 1106 },
  { name: "MFG Data Apps>> CFC: Feature Request >> (keywords: CFC, Central File Collector)", sortOrder: 1107 },
  { name: "MFG Data Apps >> CFC: Other >> (keywords: CFC, Central File Collector)", sortOrder: 1108 },
  { name: "MFG Data Apps >> CFC: Request New Data Feed >> (keywords: CFC, Central File Collector)", sortOrder: 1109 },
  { name: "MFG Data Apps >> CFC: System Down >> (keywords: CFC, Central File Collector)", sortOrder: 1110 },
  { name: "MFG Data Apps>> Cairo: Feature Request > (keywords: Cairo)", sortOrder: 1111 },
  { name: "MFG Data Apps >> Cairo: Other >> (keywords: Cairo)", sortOrder: 1112 },
  { name: "MFG Data Apps > Cairo: Request New Data Feed >> (keywords: Cairo)", sortOrder: 1113 },
  { name: "MFG Data Apps >> Cairo: System Down >> (keywords: Cairo)", sortOrder: 1114 },
  { name: "MFG Data Apps > GALAXY PAT: Feature Request >> (keywords: GALAXY, PAT)", sortOrder: 1115 },
  { name: "MFG Data Apps >> GALAXY PAT: Other >> (keywords: GALAXY, PAT)", sortOrder: 1116 },
  { name: "MFG Data Apps >> GALAXY PAT: Request New Data Feed >> (keywords: GALAXY, PAT)", sortOrder: 1117 },
  { name: "MFG Data Apps >> GALAXY PAT: System Down >> (keywords: GALAXY, PAT)", sortOrder: 1118 },
  { name: "MFG Data Apps> HDCP KEYS: Feature Request >> (keywords: HDCP KEYS, DCP)", sortOrder: 1119 },
  { name: "MFG Data Apps>> HDCP KEYS: Other>> (keywords: HDCP KEYS, DCP)", sortOrder: 1120 },
  { name: "MFG Data Apps \u00bb HDCP KEYS: System Down >> (keywords: HDCP KEYS, DCP)", sortOrder: 1121 },
  { name: "MFG Data Apps > KLA ACE: Feature Request >> (keywords: KLA, ACE, Klarity)", sortOrder: 1122 },
  { name: "MFG Data Apps >> KLA ACE: Other >> (keywords: KLA, ACE, Klarity)", sortOrder: 1123 },
  { name: "MFG Data Apps >> KLA ACE: Request New Data Feed >> (keywords: KLA, ACE, Klarity)", sortOrder: 1124 },
  { name: "MFG Data Apps \u00bb KLA ACE: System Down >> (keywords: KLA, ACE, Klarity)", sortOrder: 1125 },
  { name: "MFG Data Apps >> Lot 360: Feature Request >> (keywords: Lot 360)", sortOrder: 1126 },
  { name: "MFG Data Apps >> Lot 360: Other >> (keywords: Lot 360)", sortOrder: 1127 },
  { name: "MFG Data Apps >> Lot 360: Request New Data Feed >> (keywords: Lot 360)", sortOrder: 1128 },
  { name: "MFG Data Apps>> Lot 360: System Down >> (keywords: Lot 360)", sortOrder: 1129 },
  { name: "MFG Data Apps>> Lot History (Genealogy): Feature Request >> (keywords: Lot History, Genealogy)", sortOrder: 1130 },
  { name: "MFG Data Apps>> Lot History (Genealogy): Other >> (keywords: Lot History, Genealogy)", sortOrder: 1131 },
  { name: "MFG Data Apps>> Lot History (Genealogy): Request New Data Feed >> (keywords: Lot History, Genealogy)", sortOrder: 1132 },
  { name: "MFG Data Apps>> Lot History (Genealogy): System Down >> (keywords: Lot History, Genealogy)", sortOrder: 1133 },
  { name: "MFG Data Apps>> MDM: Feature Request >> (keywords: MDM, Manufaturing Data Mart)", sortOrder: 1134 },
  { name: "MFG Data Apps >> MDM: Other >> (keywords: MDM, Manufaturing Data Mart)", sortOrder: 1135 },
  { name: "MFG Data Apps >> MDM: Request New Data Feed >> (keywords: MDM, Manufaturing Data Mart)", sortOrder: 1136 },
  { name: "MFG Data Apps >> MDM: System Down >> (keywords: MDM, Manufaturing Data Mart)", sortOrder: 1137 },
  { name: "MFG Data Apps>> MaxVision/IGS: Feature Request >> (keywords: Inkmap Generation System, IGS, MaxVision)", sortOrder: 1138 },
  { name: "MFG Data Apps>> MaxVision/IGS: Other >> (keywords: Inkmap Generation System, IGS, MaxVision)", sortOrder: 1139 },
  { name: "MFG Data Apps>> MaxVision/IGS: Request New Data Feed >> (keywords: Inkmap Generation System, IGS, MaxVision)", sortOrder: 1140 },
  { name: "MFG Data Apps>> MaxVision/IGS: System Down >> (keywords: Inkmap Generation System, IGS, MaxVision)", sortOrder: 1141 },
  { name: "MFG Data Apps>> MfgYield: Feature Request >> (keywords: Mfg Yield, Manufacturing Yield)", sortOrder: 1142 },
  { name: "MFG Data Apps >> MfgYield: Other >> (keywords: Mfg Yield, Manufacturing Yield)", sortOrder: 1143 },
  { name: "MFG Data Apps >> MfgYield: Request New Data Feed >> (keywords: Mfg Yield, Manufacturing Yield)", sortOrder: 1144 },
  { name: "MFG Data Apps>> MfgYield: System Down>> (keywords: Mfg Yield, Manufacturing Yield)", sortOrder: 1145 },
  { name: "MFG Data Apps>> Part BOM: Feature Request >> (keywords: Part BOM, Bill Of Material)", sortOrder: 1146 },
  { name: "MFG Data Apps>> Part BOM: Other >> (keywords: Part BOM, Bill Of Material)", sortOrder: 1147 },
  { name: "MFG Data Apps>> Part BOM: Request New Data Feed >> (keywords: Part BOM, Bill Of Material)", sortOrder: 1148 },
  { name: "MFG Data Apps> Part BOM: System Down >> (keywords: Part BOM, Bill Of Material)", sortOrder: 1149 },
  { name: "MFG Data Apps>> Ptolemy (mapper): Feature Request >> (keywords: Ptolemy, mapper)", sortOrder: 1150 },
  { name: "MFG Data Apps>> Ptolemy (mapper): Other >> (keywords: Ptolemy, mapper)", sortOrder: 1151 },
  { name: "MFG Data Apps > Ptolemy (mapper): Request New Data Feed >> (keywords: Ptolemy, mapper)", sortOrder: 1152 },
  { name: "MFG Data Apps >> Ptolemy (mapper): System Down >> (keywords: Ptolemy, mapper)", sortOrder: 1153 },
  // MIPS
  { name: "MIPS >> System Accessibility/Availability (slowdown, connectivity, error)", sortOrder: 1200 },
  // OPCENTER
  { name: "OPCENTER >> ECN-APRF CREATION/ACTIVATION", sortOrder: 1300 },
  { name: "OPCENTER>>ICO", sortOrder: 1301 },
  { name: "OPCENTER>> IRAC/MRB/CAR", sortOrder: 1302 },
  { name: "OPCENTER >> Inquiry", sortOrder: 1303 },
  { name: "OPCENTER >> Manual Hold", sortOrder: 1304 },
  { name: "OPCENTER>>TRS/TIS", sortOrder: 1305 },
  // OpCenter
  { name: "OpCenter>> ECN LOT RELATED", sortOrder: 1400 },
  { name: "OpCenter>> FIRST TRACKIN", sortOrder: 1401 },
  { name: "OpCenter>> LOT PARAMETER/ ATTRIBUTE", sortOrder: 1402 },
  { name: "OpCenter>> LOT REFRESH", sortOrder: 1403 },
  { name: "OpCenter>> LOT SPLIT / MERGE", sortOrder: 1404 },
  { name: "OpCenter>> LOT TERMINATE / UNTERMINATE", sortOrder: 1405 },
  { name: "OpCenter>> MANUAL RELEASE", sortOrder: 1406 },
  { name: "OpCenter>> MS2", sortOrder: 1407 },
  { name: "OpCenter>> NEW PART ID", sortOrder: 1408 },
  { name: "OpCenter>> OWNER/LOT TYPE", sortOrder: 1409 },
  { name: "OpCenter>> OpCenter- Others", sortOrder: 1410 },
  { name: "OpCenter>> OpCenter Configure SWR/ Route/ Part number/RMA", sortOrder: 1411 },
  { name: "OpCenter> OpCenter Lot Related (Movement, Track-in/out,Split,Terminate/Un-terminate)", sortOrder: 1412 },
  { name: "OpCenter>> PRS / PRIME", sortOrder: 1413 },
  { name: "OpCenter>> QUANTITY ADJUST", sortOrder: 1414 },
  { name: "OpCenter>> SUS", sortOrder: 1415 },
  { name: "OpCenter>> SWR", sortOrder: 1416 },
  // PROMIS
  { name: "PROMIS >> FUTURE HOLD", sortOrder: 1500 },
  { name: "PROMIS >>ALERT ON UNDEFINED INFORMATION", sortOrder: 1501 },
  { name: "PROMIS >> ALLOK", sortOrder: 1502 },
  { name: "PROMIS >> DATA EXTRACT", sortOrder: 1503 },
  { name: "PROMIS >> ECN BATCH / SCRIPT RELEASE", sortOrder: 1504 },
  { name: "PROMIS >> ECN CREATION / ACTIVATION", sortOrder: 1505 },
  { name: "PROMIS>> ECN LOT RELATED", sortOrder: 1506 },
  { name: "PROMIS >> ECN-APRF CREATION/ACTIVATION", sortOrder: 1507 },
  { name: "PROMIS >> EDI-LOT", sortOrder: 1508 },
  { name: "PROMIS>> EDI-SETUP", sortOrder: 1509 },
  { name: "PROMIS>> EQS/MRB/CAR/QDN/DCD", sortOrder: 1510 },
  { name: "PROMIS>> ESR", sortOrder: 1511 },
  { name: "PROMIS >> ICO", sortOrder: 1512 },
  { name: "PROMIS>> ISR", sortOrder: 1513 },
  { name: "PROMIS >> Inquiry", sortOrder: 1514 },
  { name: "PROMIS >> LASER ACT TMI DELETION", sortOrder: 1515 },
  { name: "PROMIS >> LOT PARAMETER/ ATTRIBUTE", sortOrder: 1516 },
  { name: "PROMIS>> LOT REFRESH", sortOrder: 1517 },
  { name: "PROMIS >> LOT SPLIT/ MERGE / UNMERGE", sortOrder: 1518 },
  { name: "PROMIS >> LOT START ERROR", sortOrder: 1519 },
  { name: "PROMIS >> LOT TERMINATE / UNTERMINATE", sortOrder: 1520 },
  { name: "PROMIS >> LOT TYPE", sortOrder: 1521 },
  { name: "PROMIS >> MANUAL RECEIVE", sortOrder: 1522 },
  { name: "PROMIS>> MAP ISSUE", sortOrder: 1523 },
  { name: "PROMIS >> MCR", sortOrder: 1524 },
  { name: "PROMIS >> MOVE LOT LOCATION/STATE", sortOrder: 1525 },
  { name: "PROMIS >> MULTISITE", sortOrder: 1526 },
  { name: "PROMIS >> Modify PROMIS Account - ADPT (Probe Trim) - Equipment Engr / Tech / LM", sortOrder: 1527 },
  { name: "PROMIS>> Modify PROMIS Account - ADPT (Probe Trim) - IT Team", sortOrder: 1528 },
  { name: "PROMIS> Modify PROMIS Account - ADPT (Probe Trim) - Operators", sortOrder: 1529 },
  { name: "PROMIS >> Modify PROMIS Account - ADPT (Probe Trim) - Planner", sortOrder: 1530 },
  { name: "PROMIS >> Modify PROMIS Account - ADPT (Probe Trim) - QA/MRB", sortOrder: 1531 },
  { name: "PROMIS>> Modify PROMIS Account - ADPT (Probe Trim) - Supervisors", sortOrder: 1532 },
  { name: "PROMIS >> Modify PROMIS Account - ADPT (Probe Trim) - Test/Process/Product Engineer", sortOrder: 1533 },
  { name: "PROMIS >> Modify PROMIS Account - PROMPROD (Standard) - Equipment Engr / Tech / LM", sortOrder: 1534 },
  { name: "PROMIS >> Modify PROMIS Account - PROMPROD (Standard) - IT Team", sortOrder: 1535 },
  { name: "PROMIS >> Modify PROMIS Account - PROMPROD (Standard) - Operators", sortOrder: 1536 },
  { name: "PROMIS >> Modify PROMIS Account - PROMPROD (Standard) - Planner", sortOrder: 1537 },
  { name: "PROMIS>> Modify PROMIS Account - PROMPROD (Standard) - QA/MRB", sortOrder: 1538 },
  { name: "PROMIS >> Modify PROMIS Account - PROMPROD (Standard) - Supervisors", sortOrder: 1539 },
  { name: "PROMIS>> Modify PROMIS Account - PROMPROD (Standard) - Test/Process/Product Engineer", sortOrder: 1540 },
  { name: "PROMIS >> Modify VAX/VMS Account - ADPT (Probe Trim) - IT Team", sortOrder: 1541 },
  { name: "PROMIS >> Modify VAX/VMS Account - PROMPROD (Standard) - IT Team", sortOrder: 1542 },
  { name: "PROMIS >> NEW PART ID", sortOrder: 1543 },
  { name: "PROMIS>> New PROMIS Account - ADPT (Probe Trim) - Equipment Engr / Tech / LM", sortOrder: 1544 },
  { name: "PROMIS>> New PROMIS Account - ADPT (Probe Trim) - IT Team", sortOrder: 1545 },
  { name: "PROMIS>> New PROMIS Account - ADPT (Probe Trim) - Operators", sortOrder: 1546 },
  { name: "PROMIS>> New PROMIS Account - ADPT (Probe Trim) - Planner", sortOrder: 1547 },
  { name: "PROMIS >> New PROMIS Account - ADPT (Probe Trim) - QA/MRB", sortOrder: 1548 },
  { name: "PROMIS>> New PROMIS Account - ADPT (Probe Trim) - Supervisors", sortOrder: 1549 },
  { name: "PROMIS >> New PROMIS Account - ADPT (Probe Trim) - Test/Process/Product Engineer", sortOrder: 1550 },
  { name: "PROMIS>> New PROMIS Account - PROMPROD (Standard) - Equipment Engr / Tech / LM", sortOrder: 1551 },
  { name: "PROMIS>> New PROMIS Account - PROMPROD (Standard) - IT Team", sortOrder: 1552 },
  { name: "PROMIS >> New PROMIS Account - PROMPROD (Standard) - Operators", sortOrder: 1553 },
  { name: "PROMIS>> New PROMIS Account - PROMPROD (Standard) - Planner", sortOrder: 1554 },
  { name: "PROMIS>> New PROMIS Account - PROMPROD (Standard) - QA/MRB", sortOrder: 1555 },
  { name: "PROMIS>> New PROMIS Account - PROMPROD (Standard) - Supervisor", sortOrder: 1556 },
  { name: "PROMIS >> New PROMIS Account - PROMPROD (Standard) - Test/Process/Product Engineer", sortOrder: 1557 },
  { name: "PROMIS >> New VAX/VMS Account - ADPT (Probe Trim) - IT Team", sortOrder: 1558 },
  { name: "PROMIS >> New VAX/VMS Account - PROMPROD (Standard) - IT Team", sortOrder: 1559 },
  { name: "PROMIS >> PAT SHIP ALERT", sortOrder: 1560 },
  { name: "PROMIS >> PROBE INK DATA ENTRY", sortOrder: 1561 },
  { name: "PROMIS >> PRODS PARAMETER/ ATTRIBUTE", sortOrder: 1562 },
  { name: "PROMIS >> PRS / PRIME", sortOrder: 1563 },
  { name: "PROMIS >> QUANTITY ADJUST", sortOrder: 1564 },
  { name: "PROMIS >> SWR", sortOrder: 1565 },
  { name: "PROMIS >> System Accessibility/Availability (slowdown, connectivity, error)", sortOrder: 1566 },
  { name: "PROMIS>> TRS/TIS", sortOrder: 1567 },
  { name: "PROMIS >>ZORCH", sortOrder: 1568 },
  // PROMIS/MIPS
  { name: "PROMIS/MIPS >> Lot Related (Movement, Track-in/out, Recipe)", sortOrder: 1600 },
  { name: "PROMIS/MIPS >> MIPS Terminal link, power, connectivity issues", sortOrder: 1601 },
  { name: "PROMIS/MIPS >> PROMIS printer issue (alignment, network, hardware issue)", sortOrder: 1602 },
  { name: "PROMIS/MIPS >> PROMIS/MIPS account concern", sortOrder: 1603 },
  // PTOLEMY/MAPPER
  { name: "PTOLEMY/MAPPER > Map Conversion", sortOrder: 1700 },
  { name: "PTOLEMY/MAPPER >> Map Die count - Mismatch", sortOrder: 1701 },
  { name: "PTOLEMY/MAPPER >> Missing map", sortOrder: 1702 },
  // SAP to Camstar Integration
  { name: "SAP to Camstar Integration >> Box Stock Rework(BSR)", sortOrder: 1800 },
  { name: "SAP to Camstar Integration >> SAP MES Integration", sortOrder: 1801 },
  // SE-PROBE
  { name: "SE-PROBE >>Account Request", sortOrder: 1900 },
  { name: "SE-PROBE >> Administrator Rights", sortOrder: 1901 },
  { name: "SE-PROBE >> Change System Config", sortOrder: 1902 },
  { name: "SE-PROBE >> Change/Disable FAM Setting", sortOrder: 1903 },
  { name: "SE-PROBE >> Disable TD Counter", sortOrder: 1904 },
  { name: "SE-PROBE >> Engineering Request - Change Bin", sortOrder: 1905 },
  { name: "SE-PROBE >>SEP/DCC Installation", sortOrder: 1906 },
  // Supply Chain Factory Planning
  { name: "Supply Chain Factory Planning >> FP Plan issue - L-ADI", sortOrder: 2000 },
  { name: "Supply Chain Factory Planning >> FP Plan issue - L-Maxim", sortOrder: 2001 },
  // Supply Chain Finished Goods Allocation
  { name: "Supply Chain Finished Goods Allocation (FGA) >> FGA - L-ADI", sortOrder: 2100 },
  { name: "Supply Chain Finished Goods Allocation (FGA) >> FGA - L-Maxim", sortOrder: 2101 },
  // Supply Chain Forecasting
  { name: "Supply Chain Forecasting >> APO DP Demand Issue", sortOrder: 2200 },
  { name: "Supply Chain Forecasting >> BY Demand", sortOrder: 2201 },
  { name: "Supply Chain Forecasting > Cfit", sortOrder: 2202 },
  // Supply Chain Inventory Optimization
  { name: "Supply Chain Inventory Optimization >> IO - UI issue", sortOrder: 2300 },
  { name: "Supply Chain Inventory Optimization >> IO Plan issue", sortOrder: 2301 },
  { name: "Supply Chain Inventory Optimization >> Others", sortOrder: 2302 },
  // Supply Chain Order Scheduling
  { name: "Supply Chain Order Scheduling >> Adexa", sortOrder: 2400 },
  { name: "Supply Chain Order Scheduling >> Order Promiser", sortOrder: 2401 },
  // Supply Chain Planning
  { name: "Supply Chain Planning >> Brand Allocation", sortOrder: 2500 },
  { name: "Supply Chain Planning >> EPN", sortOrder: 2501 },
  { name: "Supply Chain Planning >> ESP/Pegging L-Maxim", sortOrder: 2502 },
  { name: "Supply Chain Planning >> SCP/Pegging L-ADI", sortOrder: 2503 },
  // Supply Chain Reporting
  { name: "Supply Chain Reporting >> Demand Data", sortOrder: 2600 },
  { name: "Supply Chain Reporting >> Master Data", sortOrder: 2601 },
  { name: "Supply Chain Reporting >> Metrics", sortOrder: 2602 },
  { name: "Supply Chain Reporting >> Mfg Data", sortOrder: 2603 },
  { name: "Supply Chain Reporting >> Other", sortOrder: 2604 },
  { name: "Supply Chain Reporting >> WIP and Inv Data", sortOrder: 2605 },
  // Supply Chain User Access
  { name: "Supply Chain User Access >> Database access", sortOrder: 2700 },
  { name: "Supply Chain User Access >> Web UI Access", sortOrder: 2701 },
  // Supply Chain Web Applications
  { name: "Supply Chain Web Applications >> BMUI", sortOrder: 2800 },
  { name: "Supply Chain Web Applications >> Corp Priority", sortOrder: 2801 },
  { name: "Supply Chain Web Applications >> DFUI", sortOrder: 2802 },
  { name: "Supply Chain Web Applications >> Hot List", sortOrder: 2803 },
  { name: "Supply Chain Web Applications >> Load Manager", sortOrder: 2804 },
  { name: "Supply Chain Web Applications >> Others", sortOrder: 2805 },
  { name: "Supply Chain Web Applications >> Parts Profile", sortOrder: 2806 },
  { name: "Supply Chain Web Applications >> Sales Order Tracking", sortOrder: 2807 },
  { name: "Supply Chain Web Applications >> Supply Health", sortOrder: 2808 },
  // Test Systems
  { name: "Test Systems >> ADGTSMB1 Access", sortOrder: 2900 },
  { name: "Test Systems >> IGFT Part Name Creation", sortOrder: 2901 },
  { name: "Test Systems >> Pdf Exensio Access and Dashboard Issues", sortOrder: 2902 },
  { name: "Test Systems >> STDF Tool Error on Laptop", sortOrder: 2903 },
  { name: "Test Systems >> STDF Tool Error on Tester", sortOrder: 2904 },
  { name: "Test Systems >> Summary Retrieval", sortOrder: 2905 },
  { name: "Test Systems >> Tester Hang-up", sortOrder: 2906 },
  { name: "Test Systems >> Tester Printing", sortOrder: 2907 },
  { name: "Test Systems >> Tester Unable to load program", sortOrder: 2908 },
  // Warehouse Operations
  { name: "Warehouse Operations >> Finish Goods Warehouse", sortOrder: 3000 },
  { name: "Warehouse Operations >> SAP MES Integration", sortOrder: 3001 },
  { name: "Warehouse Operations >> Shipment Expedite", sortOrder: 3002 },
];

async function main() {
  console.log("Seeding database...");

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminPassword    = await bcrypt.hash("Admin@12345", 10);
  const employeePassword = await bcrypt.hash("Employee@12345", 10);

  const admin = await prisma.user.upsert({
    where:  { email: "admin@mfgsystem.com" },
    update: {},
    create: {
      fullName:     "System Admin",
      email:        "admin@mfgsystem.com",
      passwordHash: adminPassword,
      role:         "ADMIN",
      isActive:     true,
    },
  });

  const employee = await prisma.user.upsert({
    where:  { email: "employee@mfgsystem.com" },
    update: {},
    create: {
      fullName:     "Juan dela Cruz",
      email:        "employee@mfgsystem.com",
      passwordHash: employeePassword,
      role:         "EMPLOYEE",
      isActive:     true,
    },
  });

  console.log("✅ Admin account created:");
  console.log(`   Email   : ${admin.email}`);
  console.log(`   Password: Admin@12345`);
  console.log(`   Role    : ${admin.role}`);

  console.log("\n✅ Employee account created:");
  console.log(`   Email   : ${employee.email}`);
  console.log(`   Password: Employee@12345`);
  console.log(`   Role    : ${employee.role}`);

  // ── Ticket Categories ──────────────────────────────────────────────────────
  console.log("\nSeeding ticket categories…");
  let created = 0;
  let skipped = 0;

  for (const cat of CATEGORIES) {
    const result = await prisma.ticketCategory.upsert({
      where:  { name: cat.name },
      update: { sortOrder: cat.sortOrder, isActive: true },
      create: { name: cat.name, sortOrder: cat.sortOrder, isActive: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`✅ Categories seeded: ${created} created, ${skipped} updated/skipped`);
  console.log(`   Total categories: ${CATEGORIES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
