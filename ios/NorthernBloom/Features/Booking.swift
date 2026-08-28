// Booking flow: service → staff → day → time → confirm.
import SwiftUI

struct BookingFlowView: View {
    @EnvironmentObject private var state: AppState
    @State private var services: [ServiceModel] = []
    @State private var staff: [StaffMember] = []
    @State private var serviceId: String?
    @State private var staffId: String? // nil = any
    @State private var date = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var slots: [Slot] = []
    @State private var pickedSlot: Slot?
    @State private var busy = false
    @State private var errorText: String?

    private static let dayFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "EEE d"
        return df
    }()
    private static let timeFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "h:mm a"
        return df
    }()

    var body: some View {
        Form {
            Section("Service") {
                ForEach(services) { svc in
                    Button {
                        serviceId = svc.id
                        Task { await loadSlots() }
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(svc.name)
                                Text("\(svc.durationMin) min").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if serviceId == svc.id { Image(systemName: "checkmark") }
                            Text(svc.priceCents == 0 ? "Free" : formatMoney(svc.priceCents))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            if serviceId != nil {
                Section("Staff") {
                    Picker("Staff member", selection: Binding(
                        get: { staffId ?? "" },
                        set: { staffId = $0.isEmpty ? nil : $0; Task { await loadSlots() } },
                    )) {
                        Text("Any available").tag("")
                        ForEach(staff) { st in
                            Text(st.name).tag(st.id)
                        }
                    }
                }

                Section("Day & time") {
                    DatePicker(
                        "Date",
                        selection: $date,
                        displayedComponents: .date,
                    )
                    .onChange(of: date) { _ in Task { await loadSlots() } }

                    if slots.isEmpty {
                        Text("No openings this day — try another.").foregroundStyle(.secondary)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 90))], spacing: 8) {
                            ForEach(slots) { slot in
                                Button {
                                    pickedSlot = slot
                                } label: {
                                    Text(slotTime(slot))
                                        .font(.subheadline)
                                        .frame(maxWidth: .infinity, minHeight: 34)
                                        .background(
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(pickedSlot?.id == slot.id ? Color.accentColor.opacity(0.3) : Color.secondary.opacity(0.12)),
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    if let errorText {
                        Text(errorText).foregroundStyle(.red).font(.footnote)
                    }

                    Button {
                        Task { await confirm() }
                    } label: {
                        if busy { ProgressView().frame(maxWidth: .infinity) }
                        else { Text("Confirm booking").bold().frame(maxWidth: .infinity) }
                    }
                    .disabled(pickedSlot == nil || busy)
                }
            }
        }
        .navigationTitle("Book appointment")
        .task {
            services = (try? await state.api.request(ServicesResponse.self, "services"))?.services ?? []
            staff = (try? await state.api.request(StaffResponse.self, "staff"))?.staff ?? []
            if let first = services.first?.id {
                serviceId = first
                await loadSlots()
            }
        }
    }

    private func slotTime(_ slot: Slot) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: slot.startsAt) {
            return Self.timeFormatter.string(from: d)
        }
        return slot.startsAt
    }

    private func loadSlots() async {
        guard let serviceId else { return }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let dayString = ISO8601DateFormatter.string(from: date, timeZone: .current, formatOptions: [.withFullDate])
        do {
            var path = "availability?serviceId=\(serviceId)&date=\(dayString)"
            if let staffId { path += "&staffId=\(staffId)" }
            slots = try await state.api.request(AvailabilityResponse.self, path).slots
        } catch {
            slots = []
        }
        pickedSlot = nil
    }

    private func confirm() async {
        guard let pickedSlot, let serviceId else { return }
        busy = true
        errorText = nil
        do {
            _ = try await state.api.request(
                AppointmentEnvelope.self, "appointments", method: "POST",
                body: BookRequest(serviceId: serviceId, staffId: pickedSlot.staffId, startsAt: pickedSlot.startsAt),
            )
        } catch {
            errorText = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - My appointments tab

struct MyAppointmentsView: View {
    @EnvironmentObject private var state: AppState
    @State private var appointments: [Appointment] = []

    var body: some View {
        NavigationStack {
            List {
                NavigationLink {
                    BookingFlowView()
                } label: {
                    Label("Book new appointment", systemImage: "plus.circle")
                }
                ForEach(appointments) { appt in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(appt.serviceName ?? "Appointment").font(.headline)
                            Spacer()
                            Text(appt.status).font(.caption).foregroundStyle(.secondary)
                        }
                        Text(formatISODateTime(appt.startsAt)).font(.subheadline).foregroundStyle(.secondary)
                        if let staffName = appt.staffName {
                            Text("with \(staffName)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
            .navigationTitle("My appointments")
            .task {
                appointments = (try? await state.api.request(AppointmentsResponse.self, "appointments?upcoming=true"))?.appointments ?? []
            }
        }
    }
}
