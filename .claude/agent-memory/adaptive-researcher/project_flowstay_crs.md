---
name: project-flowstay-crs
description: FlowStay project context — voice-driven hotel booking widget, Elixir backend, CRS adapter behavior, TravelClick iHotelier research findings
metadata:
  type: project
---

FlowStay is a voice-driven hotel booking widget with an Elixir/Phoenix backend that talks to hotel CRS systems via per-CRS adapters implementing `FlowStay.CRS.Adapter` behaviour.

**Why:** Building a normalized adapter interface so different hotel CRS systems (starting with TravelClick iHotelier) can plug in without changing core booking logic.

**How to apply:** When suggesting adapter implementations, follow the 5-operation behaviour contract: search_rooms, hold_room, extend_hold, release_hold, confirm_booking.

## Architecture notes
- Elixir app owns: WorkOS auth, admin portal, booking/payment state, Phoenix MCP server
- Python LiveKit agent interacts via MCP, not ad hoc HTTP
- Project root: /Users/fourcolors/Projects/1_active/flow-industry/flowstay/elixir/

## TravelClick iHotelier API facts (researched 2026-05-14)
- Developer portal: https://developer.travelclick.com (requires OAuth login for full docs)
- Swagger staging: https://api-staging.travelclick.com/swagger-ui/?urls.primaryName=Staging+-+Shop+V1
- REST APIs (B2C): Shop, Book, Codes, Entity, Loyalty
- SOAP APIs (B2B): PMS Connect HTNG 2011B, OTA Seamless Shopping, OTA Connect
- Auth: OAuth 2.0 (client_id + secret_key → access token)
- Hold endpoint: POST /book/v1/hotel/{hotelCode}/hold-reservation
- Book endpoint: POST /book/v1/hotel/{hotelCode}/reservation
- Hold TTL: **10 minutes** (confirmed from TravelClick docs via search)
- Payment model: iHotelier is PCI-certified; booking API takes credit card data directly (NOT a payment token from external gateway — card data collected within iHotelier's PCI scope)
- Shop response contains: roomTypes with rateplans, images, amenities, rateplan policies
- HTNG endpoint: https://connect.ihotelier.com/HTNGService/services/HTNG2011BService
