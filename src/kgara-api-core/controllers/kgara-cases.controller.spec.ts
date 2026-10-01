import { KgaraCasesController } from './kgara-cases.controller';

describe('KgaraCasesController', () => {
  let controller: KgaraCasesController;
  let caseLookupServiceMock: any;

  beforeEach(() => {
    caseLookupServiceMock = {
      findCaseByCodeOrId: jest.fn(),
      findGrossProfitByCodeOrId: jest.fn(),
    };

    controller = new KgaraCasesController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      caseLookupServiceMock,
    );
  });

  describe('getCaseByCode', () => {
    it('should delegate findCaseByCodeOrId to lookup service', async () => {
      const codeOrUuid = '4fab3f01-4fb6-4852-a891-d805d18675de';
      const mockResult = { id: codeOrUuid, soChungTu: 'GR-PDV2609-0076' };
      caseLookupServiceMock.findCaseByCodeOrId.mockResolvedValue(mockResult);

      const result = await controller.getCaseByCode(codeOrUuid);

      expect(caseLookupServiceMock.findCaseByCodeOrId).toHaveBeenCalledWith(
        codeOrUuid,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getGrossProfitByCode', () => {
    it('should delegate findGrossProfitByCodeOrId to lookup service', async () => {
      const codeOrUuid = '4fab3f01-4fb6-4852-a891-d805d18675de';
      const mockResult = { VuViecCode: 'GR-PDV2609-0076', DoanhThu: 1000 };
      caseLookupServiceMock.findGrossProfitByCodeOrId.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getGrossProfitByCode(codeOrUuid);

      expect(
        caseLookupServiceMock.findGrossProfitByCodeOrId,
      ).toHaveBeenCalledWith(codeOrUuid);
      expect(result).toEqual(mockResult);
    });
  });
});
