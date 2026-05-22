import Blob "mo:core/Blob";
import Nat64 "mo:core/Nat64";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";

module {
  public type Header = {
    name : Text;
    value : Text;
  };

  public type HttpMethod = {
    #get;
    #post;
    #head;
  };

  public type HttpResponsePayload = {
    status : Nat;
    headers : [Header];
    body : Blob;
  };

  public type TransformationInput = {
    response : HttpResponsePayload;
    context : Blob;
  };

  public type TransformationOutput = HttpResponsePayload;

  public type Transform = shared query TransformationInput -> async TransformationOutput;

  public type TransformContext = {
    function : Transform;
    context : Blob;
  };

  public type CanisterHttpRequestArgument = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [Header];
    body : ?Blob;
    method : HttpMethod;
    transform : ?TransformContext;
  };

  public func transform(input : TransformationInput) : TransformationOutput {
    {
      status = input.response.status;
      body = input.response.body;
      headers = [];
    };
  };

  public func httpGetRequest(_url : Text, _headers : [Header], _transform : Transform) : async Text {
    Runtime.trap("Stripe HTTP outcalls are not configured in this local scaffold.");
  };

  public func httpPostRequest(_url : Text, _headers : [Header], _body : Text, _transform : Transform) : async Text {
    Runtime.trap("Stripe HTTP outcalls are not configured in this local scaffold.");
  };
}
