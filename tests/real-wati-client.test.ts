import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { RealWatiClient } from "../src/wati/client.js";

vi.mock("../src/utils/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock axios.create to return a fake instance we control
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        get: mockGet,
        post: mockPost,
        delete: mockDelete,
      })),
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

describe("RealWatiClient.getContacts", () => {
  let client: RealWatiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new RealWatiClient("https://app-server.wati.io", "test-token");
  });

  it("parses WATI response where contact_list is an object with items array", async () => {
    mockGet.mockResolvedValue({
      data: {
        result: true,
        contact_list: {
          pageSize: 20,
          pageNumber: 1,
          count: 2,
          items: [
            {
              id: "c1",
              wAid: "5511999001001",
              firstName: "Carlos",
              fullName: "Carlos Mendes",
              phone: "5511999001001",
              tags: ["VIP"],
              customParams: [],
              contactStatus: "VALID",
              created: "2025-01-15T10:00:00Z",
            },
            {
              id: "c2",
              wAid: "5521988002002",
              firstName: "Ana",
              fullName: "Ana Costa",
              phone: "5521988002002",
              tags: [],
              customParams: [],
              contactStatus: "VALID",
              created: "2025-03-01T14:30:00Z",
            },
          ],
        },
      },
    });

    const result = await client.getContacts();

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].fullName).toBe("Carlos Mendes");
    expect(result.items[1].fullName).toBe("Ana Costa");
  });

  it("falls back when contact_list is already an array", async () => {
    mockGet.mockResolvedValue({
      data: {
        result: true,
        contact_list: [
          {
            id: "c1",
            wAid: "5511999001001",
            firstName: "Carlos",
            fullName: "Carlos Mendes",
            phone: "5511999001001",
            tags: [],
            customParams: [],
            contactStatus: "VALID",
            created: "",
          },
        ],
      },
    });

    const result = await client.getContacts();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].fullName).toBe("Carlos Mendes");
  });

  it("falls back to data.contacts when contact_list is absent", async () => {
    mockGet.mockResolvedValue({
      data: {
        result: true,
        contacts: [
          {
            id: "c1",
            wAid: "5511999001001",
            firstName: "Carlos",
            fullName: "Carlos Mendes",
            phone: "5511999001001",
            tags: [],
            customParams: [],
            contactStatus: "VALID",
            created: "",
          },
        ],
      },
    });

    const result = await client.getContacts();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].phone).toBe("5511999001001");
  });

  it("returns empty list when response has no recognisable contacts field", async () => {
    mockGet.mockResolvedValue({ data: { result: true } });

    const result = await client.getContacts();

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("passes tag and name filters as query params", async () => {
    mockGet.mockResolvedValue({ data: { result: true } });

    await client.getContacts({ tag: "VIP", name: "Carlos" });

    expect(mockGet).toHaveBeenCalledWith("/api/v1/getContacts", {
      params: expect.objectContaining({ tag: "VIP", name: "Carlos" }),
    });
  });
});

describe("RealWatiClient.addContact", () => {
  let client: RealWatiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new RealWatiClient("https://app-server.wati.io", "test-token");
  });

  it("returns a valid Contact when WATI responds with minimal {result: true}", async () => {
    mockPost.mockResolvedValue({ data: { result: true } });

    const contact = await client.addContact("5511999999999", "Lucas Sousa");

    expect(contact.phone).toBe("5511999999999");
    expect(contact.fullName).toBe("Lucas Sousa");
    expect(contact.wAid).toBe("5511999999999");
  });

  it("merges WATI response data when full contact is returned", async () => {
    mockPost.mockResolvedValue({
      data: {
        result: true,
        id: "contact-abc",
        wAid: "5511999999999",
        firstName: "Lucas",
        fullName: "Lucas Sousa",
        phone: "5511999999999",
        tags: [],
        customParams: [],
        contactStatus: "VALID",
        created: "2025-03-28T00:00:00Z",
      },
    });

    const contact = await client.addContact("5511999999999", "Lucas Sousa");

    expect(contact.id).toBe("contact-abc");
    expect(contact.fullName).toBe("Lucas Sousa");
    expect(contact.created).toBe("2025-03-28T00:00:00Z");
  });

  it("throws WatiApiError when WATI returns result:false with an info message", async () => {
    mockPost.mockResolvedValue({
      data: { result: false, info: "Trial account can't add contact" },
    });

    await expect(
      client.addContact("5511999999999", "Lucas Sousa")
    ).rejects.toMatchObject({ message: "Trial account can't add contact" });
  });

  it("passes name and customParams in request body", async () => {
    mockPost.mockResolvedValue({ data: { result: true } });

    await client.addContact("5511999999999", "Lucas Sousa", [
      { name: "city", value: "São Paulo" },
    ]);

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/addContact/5511999999999",
      expect.objectContaining({
        name: "Lucas Sousa",
        customParams: [{ name: "city", value: "São Paulo" }],
      })
    );
  });
});
