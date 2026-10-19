-- Sample data for local test databases only (see scripts/make-test-db.sh). Never load into a real database.
insert into countries(name,code) values ('India','IN'),('United Arab Emirates','AE'),('United States','US');
insert into states(name,country_id,code) select s.n,c.id,s.c from (values ('Haryana','HR'),('Delhi','DL'),('Punjab','PB'),('Uttar Pradesh','UP')) s(n,c), countries c where c.name='India';
insert into cities(name,state_id) select v.n,s.id from (values ('Gurugram','Haryana'),('Faridabad','Haryana'),('Sonipat','Haryana'),('Panipat','Haryana'),('New Delhi','Delhi'),('Ludhiana','Punjab'),('Noida','Uttar Pradesh')) v(n,s0) join states s on s.name=v.s0;
insert into salutations(name) values ('Mr.'),('Mrs.'),('Ms.'),('Dr.'),('M/s');
insert into professions(name) values ('Salaried'),('Business'),('Self Employed'),('Government Service'),('Retired');
insert into nationalities(name) values ('Indian'),('NRI'),('OCI'),('PIO');
insert into sources_of_enquiry(name,description) values ('Walk-in','Site visit without prior booking'),('Broker','Channel partner referral'),('Website',null),('Newspaper','Print advertisement');
insert into banks(name,ifsc_prefix,branch) values ('HDFC Bank','HDFC','Sector 29 Gurugram'),('State Bank of India','SBIN','Main Branch'),('ICICI Bank','ICIC',null),('Punjab National Bank','PUNB','Faridabad');
insert into consumers(name,mobile,salutation,nationality,source_of_enquiry,profession) values ('Sample Buyer','9000000001','Mr.','Indian','Walk-in','Salaried');
