import {
  bool,
  compile,
  makeValidator,
  pfn,
  Script,
  PPubKeyHash,
  PScriptContext,
  bs,
} from "@harmoniclabs/plu-ts";

const contract = pfn(
  [PPubKeyHash.type, bs, PScriptContext.type],
  bool
)((owner, message, ctx) => {
  const isBeingPolite = message.eq("Hello plu-ts");

  const signedByOwner = ctx.tx.signatories.some(owner.eqTerm);

  return isBeingPolite.and(signedByOwner);
});

const untypedValidator = makeValidator(contract);
const compiledContract = compile(untypedValidator);

const script = new Script("PlutusScriptV2", compiledContract);

const scriptCbor = script.cbor.toString();

export default scriptCbor;
