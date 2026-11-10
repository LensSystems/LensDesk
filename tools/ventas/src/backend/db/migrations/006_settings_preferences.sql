UPDATE settings SET data=json_set(data,
  '$.ownerName', COALESCE(json_extract(data,'$.ownerName'),''),
  '$.rfc', COALESCE(json_extract(data,'$.rfc'),''),
  '$.cashier', COALESCE(json_extract(data,'$.cashier'),''),
  '$.defaultTerm', COALESCE(json_extract(data,'$.defaultTerm'),15),
  '$.defaultBankId', CASE WHEN json_type(data,'$.defaultBankId') IS NULL
    THEN json_extract(data,'$.banks[0].id') ELSE json_extract(data,'$.defaultBankId') END,
  '$.banks', json(COALESCE((SELECT json_group_array(json(json_set(value,'$.alias',COALESCE(json_extract(value,'$.alias'),'')))) FROM json_each(data,'$.banks')),'[]'))
) WHERE id=1;
