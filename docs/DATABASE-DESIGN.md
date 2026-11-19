# Database design

## ER model

Insert [`../public/er-diagram.png`](../public/er-diagram.png) into the report. The editable vector version is [`../public/er-diagram.svg`](../public/er-diagram.svg). The diagram represents the logical entities and relationships; MongoDB stores each entity in its own collection and connects records with `ObjectId` references.

## Logical relations and highest normal form

The following normalized relations describe the logical design represented by the ER diagram. Each relation's attributes depend on its key, every determinant is a candidate key, and the model contains no non-key attributes depending on only part of a composite key. Under these stated keys, each relation is in **BCNF** (and therefore also 3NF).

| Relation | Attributes | Keys / constraints | Highest normal form |
|---|---|---|---|
| BLOOD_GROUP | Blood_Group_ID, Blood_Group_Name | PK Blood_Group_ID; Blood_Group_Name unique | BCNF |
| DONOR | Donor_ID, Name, DOB, Gender, Phone, Email, Address, Blood_Group_ID | PK Donor_ID; FK Blood_Group_ID; Phone and Email unique | BCNF |
| BLOOD_BANK | Bank_ID, Bank_Name, Address, Phone | PK Bank_ID | BCNF |
| HOSPITAL | Hospital_ID, Hospital_Name, Address, Phone | PK Hospital_ID | BCNF |
| ADMIN | Admin_ID, Name, Email, Password_Hash | PK Admin_ID; Email unique | BCNF |
| DONATION | Donation_ID, Donor_ID, Bank_ID, Donation_Date, Units_Donated | PK Donation_ID; FKs Donor_ID, Bank_ID | BCNF |
| ELIGIBILITY_CHECK | Check_ID, Donor_ID, Check_Date, Eligibility_Status | PK Check_ID; FK Donor_ID | BCNF |
| BLOOD_INVENTORY | Inventory_ID, Bank_ID, Blood_Group_ID, Units_Available | PK Inventory_ID; FKs Bank_ID, Blood_Group_ID; unique (Bank_ID, Blood_Group_ID) | BCNF |
| BLOOD_REQUEST | Request_ID, Hospital_ID, Bank_ID, Blood_Group_ID, Units_Required, Request_Date, Status, Admin_ID | PK Request_ID; FKs Hospital_ID, Bank_ID, Blood_Group_ID, Admin_ID | BCNF |
| DISTRIBUTION | Distribution_ID, Request_ID, Units_Distributed, Distribution_Date | PK Distribution_ID; FK Request_ID | BCNF |

### Functional dependencies

For each single-ID relation, its ID determines every non-key attribute: for example, `Donor_ID → Name, DOB, Gender, Phone, Email, Address, Blood_Group_ID`. The same pattern applies to every entity's ID. In `BLOOD_INVENTORY`, both `Inventory_ID` and the candidate key `(Bank_ID, Blood_Group_ID)` determine `Units_Available`. Unique donor phone/email and unique admin email are additional candidate keys when those values are present.

## MongoDB mapping

The implementation uses the following collections: `blood_groups`, `donors`, `blood_banks`, `hospitals`, `admins`, `donations`, `eligibility_checks`, `blood_inventory`, `blood_requests`, and `distributions`. MongoDB creates a unique `_id` for each document; reference fields such as `bloodGroupId`, `donorId`, and `bankId` store the referenced document's `_id`. This maps the normalized logical relations to document collections and makes the one-to-many histories explicit.

Unique indexes protect blood group names, donor contact fields, and the bank/blood-group inventory pair. MongoDB does not enforce foreign keys across collections, so the app validates references when creating donors and hospital requests. A production deployment should also use `$jsonSchema` collection validators and a transaction for the approval and inventory-distribution workflow.

## Main workflows demonstrated

1. Register a blood donor against an existing blood group.
2. Record a donation only when the donor's latest eligibility check is `Eligible`; add donated units to that bank's blood group inventory.
3. View live blood inventory grouped by bank and blood group.
4. Submit a hospital blood request and review a pending request as approved or rejected.
5. Use aggregation `$lookup` stages to display related names from referenced collections.
