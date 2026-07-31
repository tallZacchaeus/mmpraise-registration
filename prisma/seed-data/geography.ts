/**
 * Country reference data.
 *
 * Names are resolved from Intl.DisplayNames at seed time so spellings stay
 * consistent with the ICU database rather than drifting in a hand-maintained list.
 * Tuple shape: [iso2, iso3, internationalDiallingCode]
 */
export const COUNTRIES: readonly [string, string, string][] = [
  ['AF', 'AFG', '93'], ['AL', 'ALB', '355'], ['DZ', 'DZA', '213'], ['AD', 'AND', '376'],
  ['AO', 'AGO', '244'], ['AG', 'ATG', '1268'], ['AR', 'ARG', '54'], ['AM', 'ARM', '374'],
  ['AW', 'ABW', '297'], ['AU', 'AUS', '61'], ['AT', 'AUT', '43'], ['AZ', 'AZE', '994'],
  ['BS', 'BHS', '1242'], ['BH', 'BHR', '973'], ['BD', 'BGD', '880'], ['BB', 'BRB', '1246'],
  ['BY', 'BLR', '375'], ['BE', 'BEL', '32'], ['BZ', 'BLZ', '501'], ['BJ', 'BEN', '229'],
  ['BM', 'BMU', '1441'], ['BT', 'BTN', '975'], ['BO', 'BOL', '591'], ['BA', 'BIH', '387'],
  ['BW', 'BWA', '267'], ['BR', 'BRA', '55'], ['BN', 'BRN', '673'], ['BG', 'BGR', '359'],
  ['BF', 'BFA', '226'], ['BI', 'BDI', '257'], ['CV', 'CPV', '238'], ['KH', 'KHM', '855'],
  ['CM', 'CMR', '237'], ['CA', 'CAN', '1'], ['KY', 'CYM', '1345'], ['CF', 'CAF', '236'],
  ['TD', 'TCD', '235'], ['CL', 'CHL', '56'], ['CN', 'CHN', '86'], ['CO', 'COL', '57'],
  ['KM', 'COM', '269'], ['CG', 'COG', '242'], ['CD', 'COD', '243'], ['CR', 'CRI', '506'],
  ['CI', 'CIV', '225'], ['HR', 'HRV', '385'], ['CU', 'CUB', '53'], ['CY', 'CYP', '357'],
  ['CZ', 'CZE', '420'], ['DK', 'DNK', '45'], ['DJ', 'DJI', '253'], ['DM', 'DMA', '1767'],
  ['DO', 'DOM', '1809'], ['EC', 'ECU', '593'], ['EG', 'EGY', '20'], ['SV', 'SLV', '503'],
  ['GQ', 'GNQ', '240'], ['ER', 'ERI', '291'], ['EE', 'EST', '372'], ['SZ', 'SWZ', '268'],
  ['ET', 'ETH', '251'], ['FJ', 'FJI', '679'], ['FI', 'FIN', '358'], ['FR', 'FRA', '33'],
  ['GA', 'GAB', '241'], ['GM', 'GMB', '220'], ['GE', 'GEO', '995'], ['DE', 'DEU', '49'],
  ['GH', 'GHA', '233'], ['GI', 'GIB', '350'], ['GR', 'GRC', '30'], ['GD', 'GRD', '1473'],
  ['GT', 'GTM', '502'], ['GN', 'GIN', '224'], ['GW', 'GNB', '245'], ['GY', 'GUY', '592'],
  ['HT', 'HTI', '509'], ['HN', 'HND', '504'], ['HK', 'HKG', '852'], ['HU', 'HUN', '36'],
  ['IS', 'ISL', '354'], ['IN', 'IND', '91'], ['ID', 'IDN', '62'], ['IR', 'IRN', '98'],
  ['IQ', 'IRQ', '964'], ['IE', 'IRL', '353'], ['IL', 'ISR', '972'], ['IT', 'ITA', '39'],
  ['JM', 'JAM', '1876'], ['JP', 'JPN', '81'], ['JO', 'JOR', '962'], ['KZ', 'KAZ', '7'],
  ['KE', 'KEN', '254'], ['KI', 'KIR', '686'], ['KW', 'KWT', '965'], ['KG', 'KGZ', '996'],
  ['LA', 'LAO', '856'], ['LV', 'LVA', '371'], ['LB', 'LBN', '961'], ['LS', 'LSO', '266'],
  ['LR', 'LBR', '231'], ['LY', 'LBY', '218'], ['LI', 'LIE', '423'], ['LT', 'LTU', '370'],
  ['LU', 'LUX', '352'], ['MO', 'MAC', '853'], ['MG', 'MDG', '261'], ['MW', 'MWI', '265'],
  ['MY', 'MYS', '60'], ['MV', 'MDV', '960'], ['ML', 'MLI', '223'], ['MT', 'MLT', '356'],
  ['MH', 'MHL', '692'], ['MR', 'MRT', '222'], ['MU', 'MUS', '230'], ['MX', 'MEX', '52'],
  ['FM', 'FSM', '691'], ['MD', 'MDA', '373'], ['MC', 'MCO', '377'], ['MN', 'MNG', '976'],
  ['ME', 'MNE', '382'], ['MA', 'MAR', '212'], ['MZ', 'MOZ', '258'], ['MM', 'MMR', '95'],
  ['NA', 'NAM', '264'], ['NP', 'NPL', '977'], ['NL', 'NLD', '31'], ['NZ', 'NZL', '64'],
  ['NI', 'NIC', '505'], ['NE', 'NER', '227'], ['NG', 'NGA', '234'], ['MK', 'MKD', '389'],
  ['NO', 'NOR', '47'], ['OM', 'OMN', '968'], ['PK', 'PAK', '92'], ['PW', 'PLW', '680'],
  ['PS', 'PSE', '970'], ['PA', 'PAN', '507'], ['PG', 'PNG', '675'], ['PY', 'PRY', '595'],
  ['PE', 'PER', '51'], ['PH', 'PHL', '63'], ['PL', 'POL', '48'], ['PT', 'PRT', '351'],
  ['PR', 'PRI', '1787'], ['QA', 'QAT', '974'], ['RO', 'ROU', '40'], ['RU', 'RUS', '7'],
  ['RW', 'RWA', '250'], ['KN', 'KNA', '1869'], ['LC', 'LCA', '1758'], ['VC', 'VCT', '1784'],
  ['WS', 'WSM', '685'], ['SM', 'SMR', '378'], ['ST', 'STP', '239'], ['SA', 'SAU', '966'],
  ['SN', 'SEN', '221'], ['RS', 'SRB', '381'], ['SC', 'SYC', '248'], ['SL', 'SLE', '232'],
  ['SG', 'SGP', '65'], ['SK', 'SVK', '421'], ['SI', 'SVN', '386'], ['SB', 'SLB', '677'],
  ['SO', 'SOM', '252'], ['ZA', 'ZAF', '27'], ['KR', 'KOR', '82'], ['SS', 'SSD', '211'],
  ['ES', 'ESP', '34'], ['LK', 'LKA', '94'], ['SD', 'SDN', '249'], ['SR', 'SUR', '597'],
  ['SE', 'SWE', '46'], ['CH', 'CHE', '41'], ['SY', 'SYR', '963'], ['TW', 'TWN', '886'],
  ['TJ', 'TJK', '992'], ['TZ', 'TZA', '255'], ['TH', 'THA', '66'], ['TL', 'TLS', '670'],
  ['TG', 'TGO', '228'], ['TO', 'TON', '676'], ['TT', 'TTO', '1868'], ['TN', 'TUN', '216'],
  ['TR', 'TUR', '90'], ['TM', 'TKM', '993'], ['TV', 'TUV', '688'], ['UG', 'UGA', '256'],
  ['UA', 'UKR', '380'], ['AE', 'ARE', '971'], ['GB', 'GBR', '44'], ['US', 'USA', '1'],
  ['UY', 'URY', '598'], ['UZ', 'UZB', '998'], ['VU', 'VUT', '678'], ['VA', 'VAT', '379'],
  ['VE', 'VEN', '58'], ['VN', 'VNM', '84'], ['YE', 'YEM', '967'], ['ZM', 'ZMB', '260'],
  ['ZW', 'ZWE', '263'],
]

/**
 * Countries that MMPraise draws the most volunteers from are pinned to the top of
 * the searchable list; everything else sorts alphabetically after them.
 */
export const PRIORITY_COUNTRIES = ['NG', 'GB', 'US', 'CA', 'GH', 'ZA', 'KE', 'AE']

/** Subdivisions. Countries absent from this map fall back to free-text entry. */
export const STATES: Record<string, string[]> = {
  NG: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Federal Capital Territory',
    'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
    'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
  ],
  GB: ['England', 'Northern Ireland', 'Scotland', 'Wales'],
  US: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
    'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
    'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
    'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  CA: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Yukon',
  ],
  GH: [
    'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East',
    'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
  ],
  ZA: [
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga',
    'North West', 'Northern Cape', 'Western Cape',
  ],
  KE: [
    'Central', 'Coast', 'Eastern', 'Nairobi', 'North Eastern', 'Nyanza', 'Rift Valley', 'Western',
  ],
}
